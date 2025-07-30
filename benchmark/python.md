# Running a benchmark with python
These scripts let you take a dataset with human and AI texts and see how accurate the detector is. WIP.


test.py runs the benchmark. To save the output to a text file, use the command:


`python3 -u test.py | tee output.txt`


threshold.py and find-highest-accuracy.py both try to find the best parameters to use on a given run.
