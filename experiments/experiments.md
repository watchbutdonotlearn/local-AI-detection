# Experiments
## Topic Perplexity
example:


the house was the color _____
red


green


blue


violet


white


...


If the human then wrote the word, say, "the house was the color of sadness", that would be different than the "house was the color magenta". Both would be the same in the current implementation, because both magenta and "of sadness" arent in the list of tokens. Topic perplexity attempts to avoid this.


In short, current perplexity based detection methods attempt to discern a difference in word choice from what a human would write. 


This was partially inspired by the (anecdotal) observation that AI tends to almost always try to find happy endings to stories, while generally lacking the same creativity a human does.




## Sentence Fragment Weighting
below_min_p_with_weighting.py


This experiment is designed to solve two problems I noticed perplexity based AI detection approaches have. The first problem has to do with the way long words are tokenized. For example, the work "weighting" might be tokenized as "weight" + "ing". The "ing" token is predicted by the AI with almost a 100% confidence. If a particular string of text uses a lot of extremely long words, it could bias the text towards having having a higher probability of being AI solely because it has a lot of these kinds of tokens.


This experiment adds code which removes such tokens from the detection calculation. 


The second problem is similar, but for an entire sentence. Certain words can change the direction a sentence can go. For example, this sentence begins with "for example," meaning that the only thing that can come after it is an example. This means that the first token in a sentence holds a much greater significance than the rest of the tokens in a sentence. Current perplexity based approaches weight all tokens the same.


An interesting future approach would be to find some way to detect which words in a sentence actually hold the most importance. One other researcher (I unfortunately can't find the paper anymore) made an AI detector that specialized in detecting if code was written by AI. It only looked at chosen variable names and imported packages, and achieved a similar performance to analyzing all tokens in the code. Compared to a traditional perplexity based approach, it analyzes far fewer tokens, meaning it is much more economical to run. Of course, English is not structured the same way as code, but it does have some structure to it. Should proper nouns be weighted more? Anecdotally, LLMs tend to be very predictable when asked to generate fictional names. If a text uses a ton of LLM-esque proper nouns, it could prove that the text was written by AI.



## Future experiments
### Rhetorical devices (and stylometry)
One thing I have noticed is that LLMs really like to use similes. 
