# Experiments
### Topic Perplexity
example:


the house was the color _____
red


green


blue


violet


white


...


If the human then wrote the word, say, "the house was the color of sadness", that would be different than the "house was the color magenta". Both would be the same in the current implementation, because both magenta and "of sadness" arent in the list of tokens. Topic perplexity attempts to avoid this.
