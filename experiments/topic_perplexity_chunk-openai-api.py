import requests
import json
import time
import math

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


def divide_text_by_punctuation(text):
    """
    Divides an input string of text by punctuation marks such as sentences, commas, etc.

    Args:
        text: The input string of text.

    Returns:
        A list of strings, where each string is a segment of the original text
        separated by punctuation.
    """
    #written by gemini flash 2.0. it's SO FAST omg
    segments = []
    current_segment = ""
    delimiters = ['.', '!', '?', ',', ';', ':']

    i = 0
    while i < len(text):
        char = text[i]
        current_segment += char
        if char in delimiters:
            segments.append(current_segment)
            current_segment = ""
        i += 1

    if current_segment:
        segments.append(current_segment)

    # Refine segments to include space after delimiter if present in original text
    refined_segments = []
    segment_buffer = ""
    segment_list_index = 0
    text_index = 0

    while text_index < len(text) and segment_list_index < len(segments):
        segment_to_match = segments[segment_list_index]
        matched_segment = ""
        segment_char_index = 0
        while segment_char_index < len(segment_to_match) and text_index < len(text):
            if text[text_index] == segment_to_match[segment_char_index]:
                matched_segment += text[text_index]
                text_index += 1
                segment_char_index += 1
            else:
                break # Should not happen in ideal scenario if segments are correctly extracted

        refined_segments.append(matched_segment)
        segment_list_index += 1

    return refined_segments


def getNextTokenProbs(api_link, prompt):
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
        'n_probs': 2,
        'min_p': 0,
        'top_k': 2
    }
    response = requests.post(url, headers=headers, data=json.dumps(body))

    if not response.ok:
        raise Exception('Failed to analyze token')

    completion_data = response.json()
    top_probs = completion_data['completion_probabilities'][0]['top_probs']
    return top_probs

def getNextTokenProbsLayerTwo(api_link, prompt):
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
        'n_probs': 2,
        'min_p': 0,
        'top_k': 2
    }
    response = requests.post(url, headers=headers, data=json.dumps(body))

    if not response.ok:
        raise Exception('Failed to analyze token')

    completion_data = response.json()
    top_probs = completion_data['completion_probabilities'][0]['top_probs']
    return top_probs


def getBranchText(api_link, prompt):
    url = f'http://{api_link}/completion'
    headers = {
        'Content-Type': 'application/json',
    }
    body = {
        'prompt': prompt,
        'top_p': 1,
        'stop': ['.', '!', '?', ',', ';', ':'],
        'post_sampling_probs': True,
        'n_probs': 4,
        'min_p': 0.06,
        'top_k': 60
    }
    response = requests.post(url, headers=headers, data=json.dumps(body))

    if not response.ok:
        raise Exception('Failed to analyze token')

    completion_data = response.json()

    return completion_data['content']

def calculate_cosine_similarity(embedding1_json, embedding2_json):
    """
    Calculates the cosine similarity between two embeddings provided in JSON-like dictionaries.

    Args:
        embedding1_json (dict): A dictionary representing the first embedding in the specified format.
        embedding2_json (dict): A dictionary representing the second embedding in the specified format.

    Returns:
        float: The cosine similarity between the two embeddings. Returns None if there's an error
               extracting embeddings or calculating similarity.
    """
    embedding1 = embedding1_json['data'][0]["embedding"]
    embedding2 = embedding2_json['data'][0]["embedding"]

    if not isinstance(embedding1, list) or not isinstance(embedding2, list):
        print("Error: Embeddings are not lists in the input JSONs.")
        return None

    if not all(isinstance(x, (int, float)) for x in embedding1) or not all(isinstance(x, (int, float)) for x in embedding2):
        print("Error: Embeddings lists should contain only numbers (floats or ints).")
        return None

    if len(embedding1) == 0 or len(embedding2) == 0:
        print("Error: One or both embedding lists are empty.")
        return None

    if len(embedding1) != len(embedding2):
        print("Error: Embeddings must have the same dimensions to calculate cosine similarity.")
        return None

    # Calculate dot product
    dot_product_val = sum(x * y for x, y in zip(embedding1, embedding2))

    # Calculate magnitudes (Euclidean norms)
    magnitude1 = math.sqrt(sum(x**2 for x in embedding1))
    magnitude2 = math.sqrt(sum(y**2 for y in embedding2))

    if magnitude1 == 0 or magnitude2 == 0:
        print("Warning: One or both embeddings have zero magnitude, cosine similarity is undefined. Returning 0.")
        return 0.0  # Or you might want to return None or handle this differently based on context

    # Calculate cosine similarity
    cosine_similarity = dot_product_val / (magnitude1 * magnitude2)
    return cosine_similarity


def cosine_similarity(api_link, textOne, textTwo):
    # model_name = 'sentence-transformers/all-MiniLM-L6-v2'
    # #Snowflake/snowflake-arctic-embed-l-v2.0
    # # note: snowflake if kinda broken.
    # #sentence-transformers/all-MiniLM-L6-v2
    # model = SentenceTransformer(model_name)
    #
    # return float(model.similarity(model.encode(textOne), model.encode(textTwo)))

    url = f'http://{api_link}/v1/embeddings'
    headers = {
        'Content-Type': 'application/json',
    }
    body = {
        "input": textOne,
        "model": "text-embedding-ada-002",
        "encoding_format": "float"
    }

    bodyTwo = {
        "input": textTwo,
        "model": "text-embedding-ada-002",
        "encoding_format": "float"
    }
    response = requests.post(url, headers=headers, data=json.dumps(body)).json()
    responseTwo =  requests.post(url, headers=headers, data=json.dumps(bodyTwo)).json()

    # print(response)

    return calculate_cosine_similarity(response, responseTwo)










# REPLACE WITH A FUNCTION THAT LOOPS THROUGH BENCHMARK CODE:
input_text = 'In the realm of human ambition, there lies a peculiar tale - one that encapsulates the very essence of mankinds unrelenting pursuit of knowledge and innovation. This narrative takes us back to the early days of aviation, when the concept of flight was still largely confined within the realms of dreams and fantasies. It is during this era that we encounter our protagonist - a man whose name has been lost to the sands of time but who remains forever etched in the annals of history for his indomitable spirit and relentless determination.'

input_text = '''The Natural Splendor of Uganda: A Symphony of Landscapes
Uganda stands as a testament to nature's extraordinary diversity, where every vista tells a story of ecological richness and pristine beauty. From its mist-shrouded mountains to its sprawling savannas, the country presents an unparalleled tapestry of natural wonders that has rightfully earned it the title "Pearl of Africa."
In the country's southwestern corner, the Bwindi Impenetrable Forest rises from the earth like a green cathedral. This ancient forest, dating back over 25,000 years, harbors some of the world's last remaining mountain gorillas. The forest canopy, a dense weave of emerald leaves and twisted vines, creates an otherworldly atmosphere where sunlight filters through in ethereal beams. The Rwenzori Mountains, aptly named the "Mountains of the Moon," pierce the clouds with their snow-capped peaks, despite their location near the equator. Their slopes host unique alpine vegetation, creating surreal landscapes where giant lobelias and eternal flowers bloom in the thin mountain air.
Uganda's waterways form the lifeblood of its ecosystems. The mighty Nile River begins its epic northward journey here, emerging from Lake Victoria in a spectacular display at Murchison Falls, where the river forces its way through a narrow gorge before cascading 43 meters into the waters below. Lake Victoria, Africa's largest lake, paints the horizon with endless shades of blue, its waters teeming with life and its shores dotted with verdant islands.
The serene Lake Bunyonyi, surrounded by terraced hills, mirrors the sky like a scattered handful of sapphires. Its 29 islands create a maze of tranquil waterways, each telling its own story through the ages. The crystal-clear waters provide sanctuary to numerous bird species, their calls creating a natural symphony at dawn and dusk.
Queen Elizabeth National Park presents a different face of Uganda's beauty. Here, the landscape opens into vast savannas where acacia trees dot the horizon and elephants parade across golden grasslands. The park's unique location, straddling the equator, creates diverse habitats that support an extraordinary variety of wildlife. The famous tree-climbing lions of Ishasha add an element of surprise to this magnificent landscape, as they drape themselves over fig tree branches, surveying their domain with regal indifference.
Kibale Forest National Park showcases the country's primate heritage amidst a stunning backdrop of tropical forest. The forest floor is a canvas of fallen leaves and delicate fungi, while above, the canopy buzzes with life. Here, chimpanzees swing through the branches, their calls echoing through the forest corridors. The diversity of butterflies adds splashes of color to the green tapestry, their wings catching sunlight like stained glass.
What makes Uganda's natural beauty truly exceptional is the way these diverse elements harmonize. The transition from one ecosystem to another creates edge effects where biodiversity flourishes. Mountain slopes give way to forest valleys, savannas merge with wetlands, and rivers thread through it all, creating corridors of life. The country's location at the intersection of East African savanna and West African rainforest creates a unique blend of habitats that supports an extraordinary array of species.
The changing seasons paint Uganda's landscapes in different hues throughout the year. The dry season reveals the architectural beauty of leafless trees and the drama of wildlife congregating around water sources. When the rains come, the land transforms into a verdant paradise, with wildflowers carpeting the savannas and waterfalls swelling to their full majesty.
Uganda's natural beauty is not just an accident of geography but also a testament to conservation efforts. The country's protected areas serve as living museums of ecological processes, preserving not just individual species but entire ecosystems. These conservation areas allow natural beauty to evolve and adapt, ensuring that future generations can witness the same splendor that has captivated visitors for centuries.
The natural beauty of Uganda represents more than just scenic landscapes; it embodies the vital connection between land and life, between preservation and prosperity. As climate change and human development pose new challenges, the country's natural heritage stands as a reminder of what we must protect – not just for its aesthetic value, but for its role in maintaining the delicate balance of our planet's ecosystems.'''

input_text = '''Socialist Democracy (, DS) is a far-left Trotskyist group in Brazil. Formed in 1979, DS was affiliated to the United Secretariat of the Fourth International. DS was one of the first groups to affiliate with the Workers' Party (PT) when the PT formed in 1980. The activists in Socialist Democracy hoped to transform the PT into a revolutionary socialist party. As the PT grew, DS grew to become one of the largest Trotskyist organizations in the world. DS has been most prominent in the municipal government of Porto Alegre, where DS member Raul Pont was vice-mayor from 1992 to 1996 and mayor from 1996 to 2000, and the state government of Rio Grande do Sul. DS members played a significant role in the elaboration of the Participatory Budget (though they had initially opposed its introduction) and also in the arrangements for the three World Social Forums held in Porto Alegre.'''

# Example usage:
api_link = '127.0.0.1:8080'



prompt_template = '<start_of_turn>user\n{promptMessage}<end_of_turn>\n<start_of_turn>model\n'

def run_analysis(inputText, answer):
    generate_prompt_query = [{'role': 'user', 'content': f'You will write a short prompt for a language model that will output the following text. Make sure to include the tone and style of the text, as well as specific details from the text. Only output the prompt.\n\n{inputText}'}]

    number_words_in_input = len(input_text.split())

    fullGeneratedReversePrompt = requestReversePrompt(api_link, generate_prompt_query, prompt_template)
    # print(fullGeneratedReversePrompt)

    generatedPromptTokenLength = tokenize_generated_prompt(api_link, fullGeneratedReversePrompt)

    seperatedSentences = divide_text_by_punctuation(inputText)
    # print(seperatedSentences)

    # print(getNextTokenProbs(api_link, fullGeneratedReversePrompt))

    cumulativeList = []
    cumulative_string = "placeholder"
    cumulativeList.append(cumulative_string) # Add the initial empty string

    for item in seperatedSentences:
        cumulative_string += item
        cumulativeList.append(cumulative_string)

    #print(cumulativeList)

    tokenProbList = []
    combinedBranchList = []
    for index, item in enumerate(cumulativeList):
        prompt = fullGeneratedReversePrompt + item
        if index == 0:
            prompt = fullGeneratedReversePrompt
        if index == len(cumulativeList) - 1:
            break
        #print(index, "prompt", prompt)
        probability = getNextTokenProbs(api_link, prompt)
        #print(probability)
        # tokenProbList.append(probability)

        #start branching from this particular token
        branchList = []
        for token in probability:
            # 2nd layer of tree
            layerPrompt = prompt + token["token"]
            layerProbability = getNextTokenProbsLayerTwo(api_link, layerPrompt)
            # print("layer 1 prompt: ", layerPrompt)
            for layerToken in layerProbability:
                branchPrompt = layerPrompt + layerToken["token"]
                if layerToken["prob"] * token["prob"] > 0.05:
                    currentTreeContent = getBranchText(api_link, branchPrompt)
                    #first layer token index, content, probability of entire tree
                    currentBranch = [token["token"] + layerToken["token"] + currentTreeContent, layerToken["prob"] * token["prob"]]
                    branchList.append(currentBranch)
                else:
                    currentTreeContent = "probability is less than 0.05, ignoring"
                    currentBranch = [currentTreeContent, 0]
                    branchList.append(currentBranch)
        combinedBranchList.append(branchList)
    # print("combined branch list: ", combinedBranchList)

    #cosine similarity for each branch
    newCombinedTree = []
    for index, branch in enumerate(combinedBranchList):
        # print("branch: ", branch)

        inputSentence = seperatedSentences[index]

        newBranchList = []
        for i, item in enumerate(branch):
            # cosine similarity of vector(item[0]) and inputSentenceVector
            if item[1] == 0:
                currentBranch = [item[0], 0]
                newBranchList.append(currentBranch)
            else:
                similarity = cosine_similarity('127.0.0.1:8081', inputSentence, item[0]) #placeholder, replace with cosine_similarity
                # print(similarity)
                # if similarity < 0:
                #     similarity = 0
                normalized_similarity = (similarity + 1) / 2

                probSimilarity = item[1] * similarity
                currentBranch = [item[0], probSimilarity]
                newBranchList.append(currentBranch)
        newCombinedTree.append(newBranchList)
    # print(newCombinedTree)

    averages = []

    for branch in newCombinedTree:
        tempSum = sum(item[1] for item in branch)
        average = tempSum # / len(branch)
        averages.append(average)

    print(averages)
    overallAverage = sum(item for item in averages) / len(averages)
    print("overall average: ", overallAverage)
    return overallAverage







def evaluate_analysis(dataset):
    results = []
    start = time.time()

    for entry in dataset:
        input_text = entry['input_text']
        expected_answer = entry['is_human']
        index = entry['index']

        # Run the analysis function
        analysis_result = run_analysis(input_text, expected_answer)

        print("expected answer: ", expected_answer)

        print("index:", index)
        end = time.time()
        elapsed = end - start
        # print("time elapsed: ", elapsed)
        print("time elapsed per iteration: ", elapsed / index)

        # Append the result to the results array
        results.append([analysis_result, expected_answer])

    return results



with open("kaggle-test-20.json", 'r') as f:
    data = json.load(f)


evaluation_results = evaluate_analysis(data)

#print(cosine_similarity('127.0.0.1:8081', "hi", "hi!"))

# run_analysis(input_text, False)

print(evaluation_results)
