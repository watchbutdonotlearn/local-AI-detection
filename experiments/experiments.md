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


In short, current perplexity based detection methods attempt to discern a difference in word choice or style from what a human would write. This method attempts to discern a difference in what general idea an LLM wishes to convey.


This was partially inspired by the (anecdotal) observation that AI tends to almost always try to find happy endings to stories, while generally lacking the same creativity a human does. On a side note, this detection method does run into a little problem when using a generated reverse prompt. Because the reverse prompt captures the topic of the input text, it reduces the effectiveness of this method. 
But if using the original prompt (for example, in an academic setting) to analyze the text, it can also be thwarted if the LLM user was smart enough to prompt the LLM with what direction he wants the LLM to take instead of naievely asking the LLM to respond to the prompt.
Taking the academic setting example, suppose that a history class has an essay prompt "was this historical figure good or bad?" Simply inputting that question into an LLM would probably give you an answer along the lines of "Both viewpoints are valid," while a student might take a hardliner stance on one side. This disrepancy is exactly what topic perplexity aims to measure. But if the student asks the LLM to "argue that the historical figure has done irreperable damage to human society," then this analysis method falls apart.


TL;DR: traditional perplexity based approaches (and others) are still better. This doesn't mean this method is useless, rather, it probably needs to be used in conjunction with other methods.


## Sentence Fragment Weighting
below_min_p_with_weighting.py


This experiment is designed to solve two problems I noticed perplexity based AI detection approaches have. The first problem has to do with the way long words are tokenized. For example, the work "weighting" might be tokenized as "weight" + "ing". The "ing" token is predicted by the AI with almost a 100% confidence. If a particular string of text uses a lot of extremely long words, it could bias the text towards having having a higher probability of being AI solely because it has a lot of these kinds of tokens.


This experiment adds code which removes such tokens from the detection calculation. 


The second problem is similar, but for an entire sentence. Certain words can change the direction a sentence can go. For example, this sentence begins with "for example," meaning that the only thing that can come after it is an example. This means that the first token in a sentence holds a much greater significance than the rest of the tokens in a sentence. Current perplexity based approaches weight all tokens the same.


An interesting future approach would be to find some way to detect which words in a sentence actually hold the most importance. One other researcher (I unfortunately can't find the paper anymore) made an AI detector that specialized in detecting if code was written by AI. It only looked at chosen variable names and imported packages, and achieved a similar performance to analyzing all tokens in the code. Compared to a traditional perplexity based approach, it analyzes far fewer tokens, meaning it is much more economical to run. Of course, English is not structured the same way as code, but it does have some structure to it. Should proper nouns be weighted more? Anecdotally, LLMs tend to be very predictable when asked to generate fictional names. If a text uses a ton of LLM-esque proper nouns, it could prove that the text was written by AI.



## Future experiments
### Rhetorical devices (and stylometry)
One thing I have noticed is that LLMs really like to use similes. 
