import csv
import re

input_file = 'output.txt'
output_file = 'parsed_results.csv'

fieldnames = ['chosenprobs', 'suspiciousness', 'expected_answer', 'longer_than_75_words']
results = []
block = {}

with open(input_file, 'r') as f:
    for line in f:
        line = line.strip()
        
        # Start of a new block
        if line == '-----------------------------------------------------------------------------------------------':
            if block:
                results.append(block)
                block = {}
            continue

        # if 'NOT ADDING TO FINAL RESULTS' in line.lower():
        #     block = {}

        # Exact line matches
        if line.startswith('chosenprobs'):
            block['chosenprobs'] = line[13:]

        elif line.startswith('suspiciousness'):
            block['suspiciousness'] = line[16:]

        elif line.startswith('expected_answer: '):
            if line[18:] == "True":
                block['expected_answer'] = True
            else:
                block['expected_answer'] = False

        if 'top 10 percent average high in human text' in line.lower():
            block['longer_than_75_words'] = True



# Add final block
if block:
    results.append(block)

resultsCleaned = []
numberDiscarded = 0
for row in results:
    try:
        if row['longer_than_75_words']:
            resultsCleaned.append(row)
    except:
        numberDiscarded += 1

print('number discarded due to too few words:', numberDiscarded)
# Write to CSV
with open(output_file, 'w', newline='') as csvfile:
    writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
    writer.writeheader()
    for row in resultsCleaned:
        writer.writerow({k: row.get(k, None) for k in fieldnames})

print(f"✅ Extracted {len(resultsCleaned)} entries into {output_file}")
