import requests
import json
import time
import re

def requestReversePrompt(api_link, generate_prompt_query, prompt_template):
    # Construct the full URL
    url = f'http://{api_link}/v1/chat/completions'

    # Prepare the headers and body for the POST request
    headers = {
        'Content-Type': 'application/json',
    }

    body = {
        'messages': generate_prompt_query,
    }

    # Make the POST request
    response = requests.post(url, headers=headers, data=json.dumps(body))

    # Check if the request was successful
    if response.status_code == 200:
        # Parse the JSON response
        generated_prompt_data = response.json()

        # Extract the generated prompt message
        generated_prompt_message = generated_prompt_data['choices'][0]['message']['content']
        #print(generated_prompt_message)

        # Replace the placeholder in the prompt template with the generated message
        full_generated_prompt = prompt_template.replace('{promptMessage}', generated_prompt_message)

        return full_generated_prompt
    else:
        # Handle the error if the request was not successful
        print(f"Error: {response.status_code} - {response.text}")
        return None



def tokenize_generated_prompt(api_link, full_generated_prompt):
    # Construct the full URL for the tokenize endpoint
    url = f'http://{api_link}/tokenize'

    # Prepare the headers and body for the POST request
    headers = {
        'Content-Type': 'application/json',
    }

    body = {
        'content': full_generated_prompt,
        'with_pieces': True,
    }

    # Make the POST request
    response = requests.post(url, headers=headers, data=json.dumps(body))

    # Check if the request was successful
    if response.status_code == 200:
        # Parse the JSON response
        tokenization_data = response.json()

        # Extract the length of the tokens
        token_length = len(tokenization_data['tokens'])

        return token_length
    else:
        # Handle the error if the request was not successful
        print(f"Error: {response.status_code} - {response.text}")
        return None


def tokenize_and_initialize_arrays(api_link, full_generated_prompt, input_text):
    # Construct the full URL for the tokenize endpoint
    url = f'http://{api_link}/tokenize'

    # Prepare the headers and body for the POST request
    headers = {
        'Content-Type': 'application/json',
    }

    body = {
        'content': full_generated_prompt + input_text,
        'with_pieces': True,
    }

    # Make the POST request
    response = requests.post(url, headers=headers, data=json.dumps(body))

    # Check if the request was successful
    if not response.ok:
        raise Exception('Failed to tokenize input text')

    # Parse the JSON response
    tokenize_data = response.json()

    # Extract token pieces
    tokens = [token['piece'] for token in tokenize_data['tokens']]

    # Initialize arrays for suspiciousness, top logprobs, and chosen token probabilities
    suspiciousness = [None] * len(tokens)
    top_logprobs_list = [None] * len(tokens)
    chosen_token_prob_list = [None] * len(tokens)

    return tokens, suspiciousness, top_logprobs_list, chosen_token_prob_list


def update_arrays_with_completion(
    api_link, tokens, generated_prompt_token_length, suspiciousness, top_logprobs_list, chosen_token_prob_list
):
    number_suspicious_low = 0
    number_suspicious = 0
    number_first_in_sentence_fragment = 0
    number_first_in_sentence_fragment_and_probzero = 0

    for i in range(generated_prompt_token_length, len(tokens)):
        # All tokens before the current one
        prompt = ''.join(tokens[:i])

        # Current token with spaces removed
        current_token_spaces = tokens[i]
        current_token = current_token_spaces.replace(' ', '')

        # Make a request to the /completion endpoint
        url = f'http://{api_link}/completion'
        headers = {
            'Content-Type': 'application/json',
        }
        body = {
            'prompt': prompt,
            'top_p': 1,
            'n_predict': 1,
            'post_sampling_probs': True,
            'n_probs': 10,
            'min_p': 0.08,
        }

        response = requests.post(url, headers=headers, data=json.dumps(body))

        if not response.ok:
            raise Exception('Failed to analyze token')

        completion_data = response.json()

        # Store top logprobs for the current token
        top_logprobs = completion_data['completion_probabilities'][0]['top_probs']
        top_logprobs_list[i] = top_logprobs

        # Find the index of the current token in the top_logprobs list
        token_index = next(
            (index for index, entry in enumerate(top_logprobs)
            if entry['token'].replace(' ', '') == current_token
        ), None)

        chosen_token_probability = 0

        # Calculate suspiciousness score
        if token_index == 0:
            suspiciousness[i] = 10  # Top of the list
            chosen_token_probability = top_logprobs[0]['prob']
        elif token_index is not None and 0 < token_index < 10:
            suspiciousness[i] = 10 - token_index  # Between 1st and 10th
            chosen_token_probability = top_logprobs[token_index]['prob']
        else:
            suspiciousness[i] = -1  # Not in the top 10 or not found
            chosen_token_probability = 0

        # Modify suspiciousness value depending on how probable the token is
        if chosen_token_probability < 0.01:
            suspiciousness[i] -= 5.5
        elif chosen_token_probability < 0.02:
            suspiciousness[i] -= 4.5
        elif chosen_token_probability < 0.05:
            suspiciousness[i] -= 2.5
        elif chosen_token_probability < 0.3:
            suspiciousness[i] -= 1.5
        elif chosen_token_probability < 0.4:
            suspiciousness[i] -= 1

        #make sure suspiciousness is only done on first token in a word
        if i > generated_prompt_token_length:
            if suspiciousness[i - 1] <= 0 and not tokens[i].startswith(" "):
                if "\n" not in tokens[i - 1] and '(' not in tokens[i - 1]:
                    if "." not in tokens[i] and "," not in tokens[i] and "!" not in tokens[i] and '\"' not in tokens[i] and ':' not in tokens[i] and ')' not in tokens[i]:
                        if not re.compile("([0-9]+)").match(tokens[i]):
                            # print(tokens[i - 1], tokens[i])
                            # print('suspiciousness i-1:', suspiciousness[i - 1])
                            suspiciousness[i] = -1

        chars = set('!.,:;?\n')
        if any((c in chars) for c in tokens[i - 1]):
            number_first_in_sentence_fragment += 1


        # Ensure suspiciousness is within bounds
        if suspiciousness[i] <= 0:
            suspiciousness[i] = -1
            number_suspicious_low += 1
            #weight probabilities of first token in sentence fragments more
            chars = set('!.,:;?\n')
            if any((c in chars) for c in tokens[i - 1]):
                print(tokens[i - 2], tokens[i - 1], tokens[i], 'is first token in sentence part. upping the weight.')
                number_suspicious_low += .5
                number_first_in_sentence_fragment_and_probzero += 1
        elif suspiciousness[i] >= 10:
            suspiciousness[i] = 10
            number_suspicious += 1

        # Store the chosen token probability
        chosen_token_prob_list[i] = chosen_token_probability

        # calculate percentage of first tokens in sentence that are prob zero
        percent_first_in_sentence_probzero = number_first_in_sentence_fragment_and_probzero / number_first_in_sentence_fragment

    return suspiciousness, top_logprobs_list, chosen_token_prob_list, number_suspicious_low, number_suspicious, percent_first_in_sentence_probzero



def remove_none_values(array):
    """
    Removes all None values from the given array (list).

    Args:
        array (list): The input list that may contain None values.

    Returns:
        list: A new list with all None values removed.
    """
    return [item for item in array if item is not None]



def remove_first_n(arr, n):
  if n < 0:
    return arr  # Return the original array if n is negative
  elif n >= len(arr):
    return []  # Return an empty list if n is greater than or equal to the length of the array
  else:
    return arr[n:] # Slice the array to remove the first n elements.


def average_bottom_5_percent(numbers):
  sorted_numbers = sorted(numbers)
  num_elements = len(sorted_numbers)
  if num_elements < 10: # 5% of 20 is 1. If less than 20 numbers, return None
    return 'not enough numbers yet'

  bottom_5_percent_count = int(num_elements * 0.1)
  bottom_5_percent = sorted_numbers[:bottom_5_percent_count]

  return sum(bottom_5_percent) / len(bottom_5_percent)

def average_top_5(numbers):
  if len(numbers) < 10:
    return 'not enough numbers yet'
  sorted_numbers = sorted(numbers, reverse=True)
  num_elements = len(sorted_numbers)
  bottom_5_percent_count = int(num_elements * 0.1)
  bottom_5_percent = sorted_numbers[:bottom_5_percent_count]
  return sum(bottom_5_percent) / len(bottom_5_percent)





# REPLACE WITH A FUNCTION THAT LOOPS THROUGH BENCHMARK CODE:
input_text = 'In the realm of human ambition, there lies a peculiar tale - one that encapsulates the very essence of mankinds unrelenting pursuit of knowledge and innovation. This narrative takes us back to the early days of aviation, when the concept of flight was still largely confined within the realms of dreams and fantasies. It is during this era that we encounter our protagonist - a man whose name has been lost to the sands of time but who remains forever etched in the annals of history for his indomitable spirit and relentless determination.'





# Example usage:
api_link = '127.0.0.1:8080'




prompt_template = '<start_of_turn>user\n{promptMessage}<end_of_turn>\n<start_of_turn>model\n'

def run_analysis(inputText, answer):
    generate_prompt_query = [{'role': 'user', 'content': f'You will write a prompt for a language model that will output the following text. Make sure to include the tone and style of the text, as well as specific details from the text. Only output the prompt.\n\n{inputText}'}]

    fullGeneratedReversePrompt = requestReversePrompt(api_link, generate_prompt_query, prompt_template)
    if fullGeneratedReversePrompt:
        print(fullGeneratedReversePrompt)

    generatedPromptTokenLength = tokenize_generated_prompt(api_link, fullGeneratedReversePrompt)

    tokens, suspiciousness, top_logprobs_list, chosen_token_prob_list = tokenize_and_initialize_arrays(
        api_link, fullGeneratedReversePrompt, inputText
    )

    updated_suspiciousness, updated_top_logprobs, updated_chosen_probs, num_low, num_high, percent_first_in_sentence_probzero = update_arrays_with_completion(
        api_link, tokens, generatedPromptTokenLength, suspiciousness, top_logprobs_list, chosen_token_prob_list
    )

    trimmed_tokens = remove_first_n(tokens, generatedPromptTokenLength)
    trimmed_suspiciousness = remove_first_n(updated_suspiciousness, generatedPromptTokenLength)
    trimmed_chosen_probs = remove_first_n(updated_chosen_probs, generatedPromptTokenLength)

    length_input_tokens = len(trimmed_tokens)

    number_words_in_input = len(input_text.split())

    # percent_high = num_high / length_input_tokens
    # percent_low = num_low / length_input_tokens

    #use word count instead of token count.
    percent_low = num_low / length_input_tokens
    percent_high = num_high / length_input_tokens

    print("percent high", percent_high * 100)
    print("percent low", percent_low * 100)

    isHuman = False

    if percent_low > 0.28:
        isHuman = True

    #print("is human:", isHuman)
    #print("expected answer:", answer)

    return isHuman, percent_low, percent_high, percent_first_in_sentence_probzero

def evaluate_analysis(dataset):
    results = []
    results_answers = []
    start = time.time()

    for entry in dataset:
        input_text = entry['input_text']
        expected_answer = entry['is_human']
        index = entry['index']

        # Run the analysis function
        analysis_result_full = run_analysis(input_text, expected_answer)
        analysis_result = analysis_result_full[0]
        analysis_result_percent_low = analysis_result_full[1]
        percent_first_in_sentence_probzero = analysis_result_full[3]

        print("index:", index)
        end = time.time()
        elapsed = end - start
        # print("time elapsed: ", elapsed)
        print("time elapsed per iteration: ", elapsed / index)

        # Compare the result with the expected answer
        is_correct = (analysis_result == expected_answer)

        print("is correct:", is_correct)

        # Append the result to the results array
        #percent low, expected answer, is correct, percent high
        if len(entry['input_text'].split()) > 75:
            print('length is above 50 words. Continuing.')
            results.append([analysis_result_percent_low, expected_answer, is_correct, analysis_result_full[2], percent_first_in_sentence_probzero])
            results_answers.append(is_correct)
        else:
            print('length is below 50 words, NOT ADDING TO FINAL RESULTS')
            continue

        if not is_correct:
            print('input text that fooled the AI detector: ', input_text)

        average_results = sum(results_answers) / len(results)
        with open('resultsfile.txt', 'a') as the_file:
            the_file.write(f'[{analysis_result_percent_low}, {expected_answer}, {is_correct}]\n')

        print("average results: ", average_results)

        humanTexts = []
        humanTextsHigh = []
        aiTexts = []
        aiTextsHigh = []

        humanFirstFragment = []
        aiFirstFragment = []
        for item in results:
            if item[1] == True:
                humanTexts.append(item[0])
                humanTextsHigh.append(item[3])
                humanFirstFragment.append(item[4])
            else:
                aiTexts.append(item[0])
                aiTextsHigh.append(item[3])
                aiFirstFragment.append(item[4])
        if len(humanTexts) > 0:
            print('average percent low score of human text:', sum(humanTexts) / len(humanTexts))
            print('lowest percent low in human text:', min(humanTexts))
            print('bottom 10 percent average for percent low (human):', average_bottom_5_percent(humanTexts))
            print('top 10 percent average high in human text:', average_top_5(humanTextsHigh))
            print('average percent first word in sentence frament thats prob zero for human text:', sum(humanFirstFragment) / len(humanFirstFragment))
        if len(aiTexts) > 0:
            print('average percent low score of AI text:', sum(aiTexts) / len(aiTexts))
            print('highest percent low in AI text:', max(aiTexts))
            print('top 10 percent average for percent low (AI):', average_top_5(aiTexts))
            print('bottom 10 percent average high in AI text:', average_bottom_5_percent(aiTextsHigh))
            print('average percent first word in sentence frament thats prob zero for ai text:', sum(aiFirstFragment) / len(aiFirstFragment))
        print('-----------------------------------------------------------------------------------------------')

    return results

# Example dataset
# dataset = [
#     {'input_text': 'Sample text 1', 'answer': True},
#     {'input_text': 'Sample text 2', 'answer': False},
#     {'input_text': 'Sample text 3', 'answer': True},
#     # Add more entries as needed
# ]



with open("kaggle-test.json", 'r') as f:
    data = json.load(f)


evaluation_results = evaluate_analysis(data)

print(evaluation_results)
