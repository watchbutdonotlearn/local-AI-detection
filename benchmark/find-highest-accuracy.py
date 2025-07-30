import csv
import ast

below_min_p_thresholds = [] #24 thresholds
current = 0.005
while current <= 0.4:
    below_min_p_thresholds.append(current)
    current += 0.005

results = []
correct_answers = []

with open('parsed_results.csv', 'r') as file:
    reader = csv.DictReader(file)  #  Uses the first row as headers

    for row in reader:
        #suspiciousness = ast.literal_eval(row['suspiciousness'])
        chosenprobs = ast.literal_eval(row['chosenprobs'])
        correct_answers.append(row['expected_answer'])

        results_list = []

        for threshold in below_min_p_thresholds:
            number_below_threshold = 0
            for prob in chosenprobs:
                if prob < threshold:
                    number_below_threshold += 1
            #appends percent low
            results_list.append(number_below_threshold / len(chosenprobs))

        results.append(results_list)
    # print(results)
    # print(correct_answers)
    accuracy_values = []
    for index in range(0, len(below_min_p_thresholds) - 1):
        temp_results = []
        for i, item in enumerate(results):
            temp_results.append(item[index])
        # print(temp_results)

        #threshold testing
        x = min(temp_results)
        y = max(temp_results)
        # print(x, y)
        numbers = [x + i * (y - x) / 149 for i in range(150)]

        accuracies = [0]
        best_threshold = 0
        for threshold in numbers:
            number_correct = 0
            for i, item in enumerate(temp_results):
                a = str(item > threshold)
                c = str(item > threshold + 0.0)
                b = correct_answers[i]
                # print(i, a, b)
                if a == b:
                    number_correct += .9
                if c == b:
                    number_correct += .1
            accuracy = number_correct / len(temp_results)
            if accuracy > max(accuracies):
                best_threshold = threshold
            accuracies.append(accuracy)
        print('below min p threshold:', f"{round(below_min_p_thresholds[index], 3):.3f}", '  max accuracy:', f"{max(accuracies):.6f}", '  percent low threshold:', best_threshold)
        accuracy_values.append(max(accuracies))
    print('max accuracy:', max(accuracy_values))
