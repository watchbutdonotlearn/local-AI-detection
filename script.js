var probsPanelOpen = false
var currentSelectedToken = [0, 0];

document.getElementById('runAnalysis').addEventListener('click', async () => {
  const inputText = document.getElementById('inputText').value;
  const resultsBox = document.getElementById('resultsBox');
  const colorCodedResultsBox = document.getElementById('colorCodedResultsBox');
  const logprobsPanel = document.getElementById('logprobsPanel');
  const logprobsContent = document.getElementById('logprobsContent');

  var probsPanelOpen = false

  resultsBox.innerHTML = ''; // Clear previous results
  colorCodedResultsBox.innerHTML = ''; // Clear previous color-coded results
  logprobsPanel.classList.remove('active'); // Hide logprobs panel

  if (!inputText) {
    resultsBox.textContent = 'Please enter some text to analyze.';
    return;
  }

  try {
    // Step 1: Tokenize the input text
    const tokenizeResponse = await fetch('http://127.0.0.1:8080/tokenize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: inputText,
        with_pieces: true,
      }),
    });

    if (!tokenizeResponse.ok) {
      throw new Error('Failed to tokenize input text');
    }

    const tokenizeData = await tokenizeResponse.json();
    const tokens = tokenizeData.tokens.map(token => token.piece); // Extract token pieces

    // Array to store suspiciousness scores
    const suspiciousness = new Array(tokens.length).fill(null); // First token has no score
    const topLogprobsList = new Array(tokens.length).fill(null); // Store top logprobs for each token
    var topTokenProbList = new Array(tokens.length).fill(null);

    //so I guess
    //for (let i=n ...)
    //where n is the number of tokens in the reverse prompt given by another AI
    //wouldn't be an issue actually
    //and we just make the "tokens" array that this loop uses into "tokensCombined", where tokensCombined is tokens + tokensReversePrompt
    // #######################################################################################################################################################################

    var numberSuspicious = 0

    // Step 2: Analyze each token (skip the first one)
    for (let i = 1; i < tokens.length; i++) {
      const prompt = tokens.slice(0, i).join(''); // All tokens before the current one
      console.log("prompt: " + prompt)
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
      console.log(tokenIndex)

      var topTokenProbability = 0

      // Calculate suspiciousness score
      if (tokenIndex === 0) {
        suspiciousness[i] = 10; // Top of the list
        topTokenProbability = topLogprobs[0].prob
        numberSuspicious = numberSuspicious++
      } else if (tokenIndex > 0 && tokenIndex < 10) {
        suspiciousness[i] = 10 - tokenIndex; // Between 1st and 10th
        topTokenProbability = topLogprobs[tokenIndex].prob
      } else {
        suspiciousness[i] = -1; // Not in the top 10 or not found
        topTokenProbability = 0
      }

      //modify suspiciousness value depending on how probable the token is
      if (topTokenProbability < 0.6){
        suspiciousness[i] = suspiciousness[i] - 1
      } else if (topTokenProbability < 0.4){
        suspiciousness[i] = suspiciousness[i] - 3
      } else if (topTokenProbability < 0.1){
        suspiciousness[i] = suspiciousness[i] - 4
      } else if (topTokenProbability < 0.05){
        suspiciousness[i] = suspiciousness[i] - 7
      }

      if (suspiciousness[i] < 0){
        suspiciousness[i] = -1
      }

      console.log("current token probability: " + topTokenProbability)


      topTokenProbList[i] = topTokenProbability.toFixed(2)

      // Update the original results box
      /*resultsBox.textContent = tokens
        .map((token, index) => {
          if (index === 0) {
            return token; // First token has no suspiciousness
          } else {
            return `${token}(${suspiciousness[index]})(${topTokenProbList[index]})`;
          }
        })
        .join(' ');*/

      // Update the color-coded results box
      colorCodedResultsBox.innerHTML = tokens
        .map((token, index) => {
          if (index === 0) {
            return `<span class="token">${token}</span>`; // First token has no suspiciousness
          } else {
            const score = suspiciousness[index];
            const color = getColorForScore(score);
            return `<span class="token" style="background-color: ${color};" data-index="${index}">${token}</span>`;
          }
        })
        .join(' ');

      // Simulate delay for better visualization
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Add click event listeners to tokens in the color-coded box
    document.querySelectorAll('#colorCodedResultsBox .token').forEach(token => {
      token.addEventListener('click', () => {
        const index = token.getAttribute('data-index');
        if (index && topLogprobsList[index]) {
          logprobsContent.innerHTML = topLogprobsList[index]
            .map(entry => `<div>${entry.token}: ${entry.prob}</div>`)
            .join('');
            logprobsContent.innerHTML += "<p>suspiciousness: " + suspiciousness[index] + "</p>";
            logprobsContent.innerHTML += "<button onclick='logprobsPanel.classList.remove(\"active\");probsPanelOpen = !probsPanelOpen;'>Close</button>";
          if (!probsPanelOpen) {
            logprobsPanel.classList.add('active');
            probsPanelOpen = !probsPanelOpen
          } else {
            logprobsPanel.classList.remove('active');
            probsPanelOpen = !probsPanelOpen
          }
        }
      });
    });
  } catch (error) {
    console.error('Error:', error);
    resultsBox.textContent = 'An error occurred while processing the text.';
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
document.getElementById('runFullAnalysis').addEventListener('click', async () => {
  document.getElementById('runAnalysis').disabled = true
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
      "content": "You will write a prompt for a language model that will output the following text. Only output the prompt. \n\n" + inputText
      },
    ]

    const generatedPromptResponse = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
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

    const fullGeneratedPrompt = `<start_of_turn>user\n${generatedPromptMessage}<end_of_turn>\n<start_of_turn>model\n`

    //console.log(fullGeneratedPrompt)

    resultsBox.textContent = 'Tokenizing generated prompt...';

    //tokenize just the generated prompt:
    const tokenizeGeneratedPromptResponse = await fetch('http://127.0.0.1:8080/tokenize', {
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
    const tokenizeResponse = await fetch('http://127.0.0.1:8080/tokenize', {
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
    var topTokenProbList = new Array(tokens.length).fill(null);

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

    // Step 2: Analyze each token (skip the first one)
    for (let i = generatedPromptTokenLength; i < tokens.length; i++) {
      const prompt = tokens.slice(0, i).join(''); // All tokens before the current one
      //console.log("prompt: " + prompt)
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
      //console.log(tokenIndex)

      var topTokenProbability = 0

      // Calculate suspiciousness score
      if (tokenIndex === 0) {
        suspiciousness[i] = 10; // Top of the list
        topTokenProbability = topLogprobs[0].prob
        numberSuspicious = numberSuspicious + 1
      } else if (tokenIndex > 0 && tokenIndex < 10) {
        suspiciousness[i] = 10 - tokenIndex; // Between 1st and 10th
        topTokenProbability = topLogprobs[tokenIndex].prob
      } else {
        suspiciousness[i] = -1; // Not in the top 10 or not found
        topTokenProbability = 0
        numberSuspiciousZero = numberSuspiciousZero + 1
      }

      //modify suspiciousness value depending on how probable the token is
      if (topTokenProbability < 0.05){
        suspiciousness[i] = suspiciousness[i] - 4
      } else if (topTokenProbability < 0.1){
        suspiciousness[i] = suspiciousness[i] - 3
      } else if (topTokenProbability < 0.3){
        suspiciousness[i] = suspiciousness[i] - 2
      } else if (topTokenProbability < 0.6){
        suspiciousness[i] = suspiciousness[i] - 1
      }

      if (suspiciousness[i] < 1){
        suspiciousness[i] = -1
        numberSuspiciousLow = numberSuspiciousLow + 1
      }

      topTokenProbList[i] = topTokenProbability

      // Update the color-coded results box
      colorCodedResultsBox.innerHTML = tokens
        .map((token, index) => {
          if (index === 0) {
            return `<span class="token">${token}</span>`; // First token has no suspiciousness
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

    //console.log(suspiciousness)

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
            logprobsContent.innerHTML += "<p>suspiciousness: " + suspiciousness[index] + "</p>";
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
    function averageArray(array) {
      var total = 0;
      for(var i = 0; i < array.length; i++) {
        total += array[i];
      }
      return total / array.length;
    }

    topTokenProbListWithoutNull = topTokenProbList.filter(element => {return element !== null;});
    //console.log(topTokenProbListWithoutNull)
    const averageTokenProbability = averageArray(topTokenProbListWithoutNull)
    const inputTokenLenth = tokens.length - generatedPromptTokenLength
    const suspiciousRatio = numberSuspicious / inputTokenLenth
    const suspiciousPercent = suspiciousRatio * 100
    const nonSusRatio = numberSuspiciousZero / inputTokenLenth
    const nonSusPercent = nonSusRatio * 100
    const nonSuspiciousLowPercent = (numberSuspiciousLow / inputTokenLenth) * 100
    resultsBox.textContent = `Done! Results:\nTotal tokens: ${tokens.length}\nInput tokens: ${inputTokenLenth}\nPercentage with suspiciousness 10: ${suspiciousPercent.toFixed(2)}%\nPercentage with 0 suspiciousness: ${nonSuspiciousLowPercent.toFixed(4)}%\nPercentage with not in probs list: ${nonSusPercent.toFixed(2)}%\nChosen token probability average: ${averageTokenProbability.toFixed(4)}`;
  } catch (error) {
    console.error('Error:', error);
    resultsBox.textContent = 'An error occurred while processing the text.';
  }
  document.getElementById('runAnalysis').disabled = false
});


