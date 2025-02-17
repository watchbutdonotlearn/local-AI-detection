var apiLink = "127.0.0.1:8080"
var promptTemplate = "<<start_of_turn>user\n{promptMessage}<end_of_turn>\n<start_of_turn>model\n"
document.getElementById("prompt-template").value = promptTemplate //because idk how any other way

const reversePromptStylePreserving = 'You will write a prompt for a language model that will output the following text, including its tone and style. Only output the prompt.\n\n'
const baseReversePromptString = "You will write a prompt for a language model that will output the following text. Only output the prompt.\n\n"
const longAndDetailedReversePromptString = "You will write a long and detailed prompt for a language model that will output the following text. Make sure to include the tone and style of the text. Only output the prompt.\n\n"

var reverseModelPrompt = baseReversePromptString
document.getElementById("prompt-reverse").value = reverseModelPrompt //because idk how any other way

var probsPanelOpen = false
var currentSelectedToken = [0, 0];

function averageArray(array) {
  var total = 0;
  for(var i = 0; i < array.length; i++) {
    total += array[i];
  }
  return total / array.length;
}

document.getElementById("save-button").addEventListener("click", function () {
  apiLink = document.getElementById("api-link").value;
  promptTemplate = document.getElementById("prompt-template").value;
  reverseModelPrompt = document.getElementById("prompt-reverse").value;
  console.log("API Link:", apiLink);
  console.log("Prompt Template:", promptTemplate);
  //alert("Settings saved!");
});

var slopResponse;
var slopPhrases;

// Fetch the phrases.json file
(async () => {
    slopResponse = await fetch('slop_phrase_prob_adjustments_5k.json');
    slopPhrases = await slopResponse.json();
})();


document.getElementById("whichPrompt").addEventListener("click", function () {
  if (document.getElementById("whichPrompt").value == 1) {
    document.getElementById("prompt-reverse").value = baseReversePromptString
  } else if (document.getElementById("whichPrompt").value == 2) {
    document.getElementById("prompt-reverse").value = reversePromptStylePreserving
  } else if (document.getElementById("whichPrompt").value == 3) {
    document.getElementById("prompt-reverse").value = longAndDetailedReversePromptString
  }
})

document.getElementById("settings-button").addEventListener("click", function () {
  const settingsContent = document.getElementById("settings-content");
  if (settingsContent.style.display === "none" || settingsContent.style.display === "") {
    settingsContent.style.display = "block";
  } else {
    settingsContent.style.display = "none";
  }
});

// Helper function to get color based on suspiciousness score
function getColorForScore(score) {
  var hue;
  if (score === -2) return 'rgba(255, 255, 255, 20)'; // Gray for invalid scores
  if (score === -1) {hue = 100};
  hue = 100 - (score / 10) * 100; // Map score to hue (0 = red, 100 = green)
  hue = hue * 1.2
  if (score == 10){
    hue = 0
  }
  return `hsl(${hue}, 100%, 80%)`;
}


//full analysis
//might remove original legacy analysis mode after this thing is done

document.getElementById('runFullAnalysis').addEventListener('click', async () => {
  const inputText = document.getElementById('inputText').value;
  const resultsBox = document.getElementById('resultsBox');
  const colorCodedResultsBox = document.getElementById('colorCodedResultsBox');
  const logprobsPanel = document.getElementById('logprobsPanel');
  const logprobsContent = document.getElementById('logprobsContent');

  resultsBox.innerHTML = ''; // Clear previous results
  colorCodedResultsBox.innerHTML = ''; // Clear previous color-coded results
  logprobsPanel.classList.remove('active'); // Hide logprobs panel

  if (!inputText) {
    resultsBox.textContent = 'Please enter some text to analyze.';
    return;
  }

  try {
    //step 0: make /completion request to get the generated "prompt"
    resultsBox.textContent = 'Getting generated prompt...';
    const generatePromptQuery = [
      {
      "role": "user",
      "content": reverseModelPrompt + inputText
      },
    ]

    console.log(reverseModelPrompt + inputText)

    const generatedPromptResponse = await fetch('http://' + apiLink + '/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
          messages: generatePromptQuery,
      }),
    });

    if (!generatedPromptResponse.ok) {
        throw new Error('Failed to get generated prompt');
    }

    const generatedPromptData = await generatedPromptResponse.json();

    //console.log(generatedPromptData)

    const generatedPromptMessage = generatedPromptData.choices[0].message.content
    console.log(generatedPromptMessage)

    //const fullGeneratedPrompt = `<start_of_turn>user\n${generatedPromptMessage}<end_of_turn>\n<start_of_turn>model\n`
    //promptTemplate = '<start_of_turn>user\n{promptMessage}<end_of_turn>\n<start_of_turn>model\n'
    const fullGeneratedPrompt = promptTemplate.replace('{promptMessage}', generatedPromptMessage);

    //console.log(fullGeneratedPrompt)

    resultsBox.textContent = 'Tokenizing generated prompt...';

    //tokenize just the generated prompt:
    const tokenizeGeneratedPromptResponse = await fetch('http://' + apiLink + '/tokenize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: fullGeneratedPrompt,
        with_pieces: true,
      }),
    });

    const generatedPromptTokenizationData = await tokenizeGeneratedPromptResponse.json();

    //console.log(generatedPromptTokenizationData)

    const generatedPromptTokenLength = generatedPromptTokenizationData.tokens.length

    resultsBox.textContent = 'Tokenizing input text...';

    // Step 1: Tokenize the input text
    const tokenizeResponse = await fetch('http://' + apiLink + '/tokenize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: fullGeneratedPrompt + inputText,
        with_pieces: true,
      }),
    });

    if (!tokenizeResponse.ok) {
      throw new Error('Failed to tokenize input text');
    }

    const tokenizeData = await tokenizeResponse.json();
    const tokens = tokenizeData.tokens.map(token => token.piece); // Extract token pieces

    // Array to store suspiciousness scores
    var suspiciousness = new Array(tokens.length).fill(null); // First token has no score
    var topLogprobsList = new Array(tokens.length).fill(null); // Store top logprobs for each token
    var chosenTokenProbList = new Array(tokens.length).fill(null);

    //so I guess
    //for (let i=n ...)
    //where n is the number of tokens in the reverse prompt given by another AI
    //wouldn't be an issue actually
    //and we just make the "tokens" array that this loop uses into "tokensCombined", where tokensCombined is tokens + tokensReversePrompt
    // #######################################################################################################################################################################

    resultsBox.textContent = 'Analyzing tokens';

    var numberSuspicious = 0
    var numberSuspiciousZero = 0
    var numberSuspiciousLow = 0

    // Step 2: Analyze each token
    for (let i = generatedPromptTokenLength; i < tokens.length; i++) {
      const prompt = tokens.slice(0, i).join(''); // All tokens before the current one
      const currentTokenSpaces = tokens[i];
      const currentToken = currentTokenSpaces.replace(/\s/g, '')

      // Make a request to the /completion endpoint
      const completionResponse = await fetch('http://127.0.0.1:8080/completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
          top_p: 1,
          n_predict: 1,
          post_sampling_probs: true,
          n_probs: 10,
          min_p: 0.06,
          //temperature: 0.1,
        }),
      });

      if (!completionResponse.ok) {
        throw new Error('Failed to analyze token');
      }

      const completionData = await completionResponse.json();

      // Store top logprobs for the current token
      topLogprobsList[i] = completionData.completion_probabilities[0].top_probs;

      // Check if the current token is in the top_logprobs list
      const topLogprobs = completionData.completion_probabilities[0].top_probs;

      const tokenIndex = topLogprobs.findIndex(
        entry => entry.token.replace(/\s/g, '') === currentToken
      );

      var topTokenProbability = 0

      // Calculate suspiciousness score
      if (tokenIndex === 0) {
        suspiciousness[i] = 10; // Top of the list
        topTokenProbability = topLogprobs[0].prob
      } else if (tokenIndex > 0 && tokenIndex < 10) {
        suspiciousness[i] = 10 - tokenIndex; // Between 1st and 10th
        topTokenProbability = topLogprobs[tokenIndex].prob
      } else {
        suspiciousness[i] = -1; // Not in the top 10 or not found
        topTokenProbability = 0
        numberSuspiciousZero = numberSuspiciousZero + 1
      }

      slopPhrases.forEach(([phrase, value]) => {
        const regex = new RegExp(`\\b${phrase}\\b`, 'gi');
        const matches = currentToken.match(regex);
        if (matches) {
            suspiciousness[i] = suspiciousness[i] + 2 * ((.32 - value) / .31) ** 3
            //console.log('triggered slop detector!!! offending word: ' + currentToken + '||||| contribution from slop: ' + 2 * ((.6 - value) / .58) ** 3)
        }
      });

      //modify suspiciousness value depending on how probable the token is
      if (topTokenProbability < 0.05){
        suspiciousness[i] = suspiciousness[i] - 7
      } else if (topTokenProbability < 0.1){
        suspiciousness[i] = suspiciousness[i] - 6
      } else if (topTokenProbability < 0.2){
        suspiciousness[i] = suspiciousness[i] - 3
      } else if (topTokenProbability < 0.3){
        suspiciousness[i] = suspiciousness[i] - 2
      } else if (topTokenProbability < 0.4){
        suspiciousness[i] = suspiciousness[i] - 1
      }

      if (suspiciousness[i] <= 0){
        suspiciousness[i] = -1
        numberSuspiciousLow = numberSuspiciousLow + 1
      }

      if (suspiciousness[i] >= 10) {
        suspiciousness[i] = 10
        numberSuspicious = numberSuspicious + 1
      }

      chosenTokenProbList[i] = topTokenProbability

      // Update the color-coded results box
      colorCodedResultsBox.innerHTML = tokens
        .map((token, index) => {
          if (index === 0) {
            return `<span class="token">${token}</span>`;
          } else {
            let score;
            if (suspiciousness[index] === null){
              score = -2;
            } else {
              score = suspiciousness[index];
            }
            const color = getColorForScore(score);
            return `<span class="token" style="background-color: ${color};" data-index="${index}">${token}</span>`;
          }
        })
        .join(' ');

      // Simulate delay for better visualization
      //await new Promise(resolve => setTimeout(resolve, 1));
    }

    // Add click event listeners to tokens in the color-coded box
    document.querySelectorAll('#colorCodedResultsBox .token').forEach(token => {
      token.addEventListener('click', () => {
        const index = token.getAttribute('data-index');
        //console.log(token)
        currentSelectedToken[1] = currentSelectedToken[0]
        currentSelectedToken[0] = index
        if (index && topLogprobsList[index]) {
          logprobsContent.innerHTML = "<p>Correct token: " + token.innerHTML + "</p>";
          logprobsContent.innerHTML += topLogprobsList[index]
            .map(entry => `<div>${entry.token}: ${entry.prob.toFixed(5)}</div>`)
            .join('');
            logprobsContent.innerHTML += "<p>Suspiciousness: " + suspiciousness[index] + "</p>";
            logprobsContent.innerHTML += "<p>Chosen token probability: " + chosenTokenProbList[index].toFixed(4) + "</p>";
            logprobsContent.innerHTML += "<button onclick='logprobsPanel.classList.remove(\"active\"); probsPanelOpen = !probsPanelOpen;'>Close</button>";
          if (!probsPanelOpen) {
            logprobsPanel.classList.add('active');
            probsPanelOpen = !probsPanelOpen
          } else if (currentSelectedToken[1] != index) {
            logprobsPanel.classList.add('active');
          } else {
            logprobsPanel.classList.remove('active');
            probsPanelOpen = !probsPanelOpen
          }
        }
      });
    });

    //finish and print results
    chosenTokenProbListWithoutNull = chosenTokenProbList.filter(element => {return element !== null;});
    const averageTokenProbability = averageArray(chosenTokenProbListWithoutNull)
    const averageSuspiciousness = averageArray(suspiciousness.slice(generatedPromptTokenLength))
    const inputTokenLenth = tokens.length - generatedPromptTokenLength
    const suspiciousRatio = numberSuspicious / inputTokenLenth
    const suspiciousPercent = suspiciousRatio * 100
    const nonSusRatio = numberSuspiciousZero / inputTokenLenth
    const nonSusPercent = nonSusRatio * 100
    const nonSuspiciousLowPercent = (numberSuspiciousLow / inputTokenLenth) * 100

    const paragraphAnalysis = analyzeParagraphs(tokens.slice(generatedPromptTokenLength), suspiciousness.slice(generatedPromptTokenLength), chosenTokenProbList.slice(generatedPromptTokenLength), inputText)
    console.log(tokens.slice(generatedPromptTokenLength))

    let slopCount = 0;
    let numberWords = inputText.split(' ').length

    // Iterate over each phrase in the list
    slopPhrases.forEach(([phrase, value]) => {
        const regex = new RegExp(`\\b${phrase}\\b`, 'gi');
        const matches = inputText.match(regex);
        if (matches) {
            slopCount += (matches.length * (.32 - value) / .29) ** 2
            //console.log('triggering slop word: ' + phrase + '     instances: ' + matches.length + ' contribution: ' + (matches.length * (.32 - value) / .31) ** 2)
        }
    });

    console.log(slopCount)

    const numberOfParagraphSusStrings = processSuspiciousSequencesLength(suspiciousness.slice(generatedPromptTokenLength))

    //resultsBox.textContent = `Done! Results:\nTotal tokens: ${tokens.length}\nInput tokens: ${inputTokenLenth}\nPercentage with suspiciousness 10: ${suspiciousPercent.toFixed(2)}%\nPercentage with 0 suspiciousness: ${nonSuspiciousLowPercent.toFixed(2)}%\nPercentage not in probability list: ${nonSusPercent.toFixed(2)}%\nChosen token probability average: ${averageTokenProbability.toFixed(4)}\n\n\n`;
    resultsBox.textContent = `Done! Results:\nInput tokens: ${inputTokenLenth}\nPercentage with suspiciousness 10: ${suspiciousPercent.toFixed(2)}%\nPercentage with 0 suspiciousness: ${nonSuspiciousLowPercent.toFixed(2)}%\nChosen token probability average: ${averageTokenProbability.toFixed(4)}\nAverage suspiciousness: ${averageSuspiciousness.toFixed(2)}\nNumber of instances where 8 tokens in a row had high suspiciousness: ${countSuspiciousStrings(suspiciousness.slice(generatedPromptTokenLength), 8)}\n${numberOfParagraphSusStrings}\nPercent "slop" words: ${((slopCount / numberWords) * 100).toFixed(2)}%\n\n\n`;

    //resultsBox.textContent += "Overall percent probability is AI:" +  isThisAI(suspiciousPercent, nonSuspiciousLowPercent, averageTokenProbability, averageSuspiciousness, ((slopCount / numberWords) * 100)) + "\n\n\n"

    resultsBox.textContent += paragraphAnalysis
  } catch (error) {
    console.error('Error:', error);
    resultsBox.textContent = 'An error occurred while processing the text.';
  }
});


function isThisAI(susPercentage, notSusPercent, avgChosenTokenProb, avgSussiness, percentageSlop) {
  let verdictWeight = 0
  if (notSusPercent > .4){verdictWeight += 7}
  else if (notSusPercent > .3){verdictWeight += 5}
  if (susPercentage > .5){verdictWeight += 3}
  if (avgChosenTokenProb > .6) {verdictWeight += 5}
  else if (avgChosenTokenProb > .5){verdictWeight += 2}
  if (percentageSlop > 5) {verdictWeight += 2}

  if (verdictWeight > 19) {verdictWeight = 19}
  let verdictPercent = (verdictWeight / 19) * 100
  return verdictPercent;
}


function countSuspiciousStrings(scores, n) {
    let count = 0;
    let i = 0;

    while (i <= scores.length - n) {
        let found = true;

        // Check if the next n scores are 9 or higher
        for (let j = 0; j < n; j++) {
            if (scores[i + j] < 8) {
                found = false;
                i += j + 1; // Skip to the end of the current sequence
                break;
            }
        }

        if (found) {
            count++;
            i += n; // Skip to the end of the found sequence
        }
    }

    return count;
}

function analyzeSlopPercentage(slopAnalyze) {
  // Iterate over each phrase in the list
    let slopCounter = 0
    slopPhrases.forEach(([phrase, value]) => {
        const regex = new RegExp(`\\b${phrase}\\b`, 'gi');
        const matches = slopAnalyze.match(regex);
        if (matches) {
            slopCounter += (matches.length * (.32 - value) / .29) ** 2
        }
    });
    let numberWords = slopAnalyze.split(' ').length
    return (slopCounter / numberWords) * 100;
}

function processSuspiciousSequencesLength(arr) {
    // Transform the array: >=9 becomes 10, then <=1 becomes 0
    let transformed = arr.map(num => num >= 9 ? 10 : num);
    transformed = transformed.map(num => num <= 1 ? 0 : num);

    // Helper function to calculate average sequence length for a target value
    const getAverageLength = (target) => {
        let currentRun = 0;
        const sequences = [];

        for (const num of transformed) {
            if (num === target) {
                currentRun++;
            } else {
                if (currentRun > 0) {
                    sequences.push(currentRun);
                    currentRun = 0;
                }
            }
        }

        // Check for any remaining run after loop ends
        if (currentRun > 0) {
            sequences.push(currentRun);
        }

        return sequences.length === 0 ? 0 : sequences.reduce((sum, len) => sum + len, 0) / sequences.length;
    };

    const avgTenLength = getAverageLength(10).toFixed(2);
    const avgZeroLength = getAverageLength(0).toFixed(2);

    return `Average length of sequences of high suspiciousness: ${avgTenLength}\nAverage length of sequences of low suspiciousness: ${avgZeroLength}`;
}

function analyzeParagraphs(tokens, scores, probabilities, initialInput) {
    let paragraphs = [];
    let currentParagraphTokens = [];
    let currentParagraphScores = [];
    let currentParagraphProbs = [];

    // Split tokens into paragraphs based on newline character
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i] === "\n" || tokens[i] === "\n\n") {
            if (currentParagraphTokens.length > 0) {
                paragraphs.push({
                    tokens: currentParagraphTokens,
                    scores: currentParagraphScores,
                    probs: currentParagraphProbs
                });
                currentParagraphTokens = [];
                currentParagraphScores = [];
                currentParagraphProbs = [];
            }
        } else {
            currentParagraphTokens.push(tokens[i]);
            currentParagraphScores.push(scores[i]);
            currentParagraphProbs.push(probabilities[i]);
        }
    }

    // Add the last paragraph if it exists
    if (currentParagraphTokens.length > 0) {
        paragraphs.push({
            tokens: currentParagraphTokens,
            scores: currentParagraphScores,
            probs: currentParagraphProbs
        });
    }

    let result = "";

    result = "Number of paragraphs: " + paragraphs.length + "\n\n"

    let initialInputSanatized = initialInput.replace(/\n\s*\n/g, '\n')
    const splitTextParagraphs = initialInputSanatized.split('\n') //split up

    // Calculate metrics for each paragraph
    for (let i = 0; i < paragraphs.length; i++) {
        const paragraph = paragraphs[i];
        const totalTokens = paragraph.tokens.length;

        // Count tokens with score 10 and 0
        let count10 = 0;
        let count0 = 0;
        for (let j = 0; j < paragraph.scores.length; j++) {
            if (paragraph.scores[j] === 10) count10++;
            if (paragraph.scores[j] === -1) count0++;
        }

        // Calculate percentages
        const percent10 = (count10 / totalTokens) * 100;
        const percent0 = (count0 / totalTokens) * 100;

        // Calculate average probability
        const totalProb = paragraph.probs.reduce((sum, prob) => sum + prob, 0);
        const avgProb = totalProb / totalTokens;

        // Get the sentence as a string
        const sentence = paragraph.tokens.join(" ");

        const averageParagraphScore = averageArray(paragraph.scores).toFixed(2)

        const numberOfParagraphSusStrings = countSuspiciousStrings(paragraph.scores)

        const paragraphSequenceSuspicious = processSuspiciousSequencesLength(paragraph.scores)

        // Append to result string
        result += `${splitTextParagraphs[i]}\nPercent with suspiciousness of 10: ${percent10.toFixed(2)}%\nPercent with 0 suspiciousness: ${percent0.toFixed(2)}%\nAverage probability: ${avgProb.toFixed(4)}\nAverage suspiciousness: ${averageParagraphScore}\nNumber of instances where 8 tokens in a row had high suspiciousness: ${numberOfParagraphSusStrings}\n${paragraphSequenceSuspicious}\nPercent "slop" words: ${analyzeSlopPercentage(splitTextParagraphs[i]).toFixed(2)}%\n\n\n`;
    }

    if (paragraphs.length == 1) {
      result = "Paragraphs: 1"
    }

    return result.trim(); // Remove the trailing newline
}
