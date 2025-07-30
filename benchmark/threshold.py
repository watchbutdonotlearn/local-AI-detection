import re
from pathlib import Path

def parse_log_file(file_content):
    """
    Parses the content of the log file to extract scores and their true classifications.

    Args:
        file_content (str): The entire string content of the log file.

    Returns:
        list[tuple[float, bool]]: A list of tuples, where each tuple contains
                                  the score (float) and the expected outcome (bool).
                                  Returns an empty list if parsing fails.
    """
    # This list will store our extracted (score, expected_answer) pairs.
    data_points = []

    # Split the file content into individual entries using the separator.
    # We filter out any empty strings that might result from the split.
    entries = [entry for entry in file_content.strip().split('-----------------------------------------------------------------------------------------------') if entry.strip()]

    for i, entry_text in enumerate(entries):
        lines = entry_text.strip().split('\n')

        score = None
        expected_answer = None

        # Iterate over each line in the entry to find our data
        for line in lines:
            # Find the score line ("percent low")
            if 'percent low:' in line:
                scorelist = [float(x) for x in re.findall(r'-?\d+\.\d+', line)]
                scoreTemp = scorelist[0] if scorelist else 0
                if scoreTemp > 2:
                    score = scoreTemp


            # Find the expected answer line
            if 'expected_answer:' in line:
                # Check if the line ends with 'True' or 'False'
                if 'True' in line:
                    expected_answer = True
                elif 'False' in line:
                    expected_answer = False

        for line in lines:
            if 'NOT ADDING TO FINAL RESULTS' in line:
                score = None

        # Ensure both pieces of information were found before adding
        if score is not None and expected_answer is not None:
            data_points.append((score, expected_answer))
        # else:
        #     print(f"Warning: Could not parse score or expected answer for entry #{i+1}. Skipping.")

    return data_points


def find_optimal_threshold(data_points):
    """
    Calculates the optimal threshold for classifying scores as good (True) or bad (False).

    Args:
        data_points (list[tuple[float, bool]]): A list of (score, expected_answer) tuples.

    Returns:
        tuple[float, float]: A tuple containing the best threshold and the highest accuracy,
                             or (None, -1.0) if no data is provided.
    """
    if not data_points:
        return None, -1.0

    # Get a sorted list of all unique scores from our data.
    # These are the only points where the accuracy can change, so they are our
    # candidate thresholds.
    unique_scores = sorted(list(set(score for score, _ in data_points)))

    best_threshold = None
    max_accuracy = -1.0

    # Test each unique score as a potential threshold
    for threshold in unique_scores:
        correct_predictions = 0

        # Evaluate this threshold against all data points
        for score, expected_answer in data_points:
            # The rule: if the score is above the threshold, it's "good" (True).
            prediction = score > threshold

            # Check if our prediction matches the ground truth
            if prediction == expected_answer:
                correct_predictions += 1

        accuracy = correct_predictions / len(data_points)

        # If this threshold gives us the best accuracy so far, store it.
        # We use '>=' to prefer a higher threshold in case of a tie.
        if accuracy >= max_accuracy:
            max_accuracy = accuracy
            best_threshold = threshold

    return best_threshold, max_accuracy

def main():
    file_path = Path("7-2ndrun-1613.txt")

    # --- Main Logic ---
    try:
        content = file_path.read_text()

        # 1. Parse the file to get scores and answers
        data = parse_log_file(content)
        if not data:
            print("Could not find any valid data points in the file.")
            return

        print(f"\nSuccessfully parsed {len(data)} data points:")
        numberScoreTooLow = 0
        for score, expected in data:
            #print(f"  - Score: {score}, Expected: {'Good' if expected else 'Bad'}")
            if score < 0:
                numberScoreTooLow = numberScoreTooLow + 1

        # 2. Find the best threshold
        best_threshold, accuracy = find_optimal_threshold(data)

        if best_threshold is not None:
            print("\n--- Results ---")
            print("Number of score too low (below 5%):", numberScoreTooLow)
            print(f"Optimal Threshold Found: {best_threshold:.2f}")
            print(f"This threshold yields an accuracy of: {accuracy:.2%}")
            print("\nRule: A score > " f"{best_threshold:.2f} will be classified as 'Good'.")
        else:
            print("\nCould not determine an optimal threshold.")

    except FileNotFoundError:
        print(f"Error: The file '{file_path}' was not found.")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

# Run the main function when the script is executed
if __name__ == "__main__":
    main()
