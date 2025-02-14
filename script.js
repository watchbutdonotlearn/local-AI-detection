document.getElementById('runAnalysis').addEventListener('click', async () => {
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
      } else if (tokenIndex > 0 && tokenIndex < 10) {
        suspiciousness[i] = 10 - tokenIndex; // Between 1st and 10th
        topTokenProbability = topLogprobs[tokenIndex].prob
      } else {
        suspiciousness[i] = -1; // Not in the top 10 or not found
        topTokenProbability = 0
      }

      if (topTokenProbability < 0.5){
        suspiciousness[i] = suspiciousness[i] - 1
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
      resultsBox.textContent = tokens
        .map((token, index) => {
          if (index === 0) {
            return token; // First token has no suspiciousness
          } else {
            return `${token}(${suspiciousness[index]})(${topTokenProbList[index]})`;
          }
        })
        .join(' ');

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
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Add click event listeners to tokens in the color-coded box
    document.querySelectorAll('#colorCodedResultsBox .token').forEach(token => {
      token.addEventListener('click', () => {
        const index = token.getAttribute('data-index');
        if (index && topLogprobsList[index]) {
          logprobsContent.innerHTML = topLogprobsList[index]
            .map(entry => `<div>${entry.token}: ${entry.prob}</div>`)
            .join('');
          logprobsContent.innerHTML += "<button onclick='logprobsPanel.classList.remove(\"active\");'>Close</button>";
          logprobsPanel.classList.add('active');
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
  if (score === -1) return '#cccccc'; // Gray for invalid scores
  const hue = 100 - (score / 10) * 100; // Map score to hue (0 = red, 100 = green)
  return `hsl(${hue}, 100%, 80%)`;
}
