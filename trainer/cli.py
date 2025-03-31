#!/usr/bin/env python
# Rewrite of the GUI script into CLI script so it can be run in a headless environment
import sys
import os
import gc
import queue
import argparse
from inquirer.questions import Checkbox, Confirm
import inquirer.prompt as prompt

# Launch parameters to get the training database and output folder before importing TensorFlow
args = argparse.ArgumentParser()
args.add_argument("--db_path", type=str, help="Path to the training database (.db file)", required=True)
args.add_argument("--output_dir", type=str, help="Path to the output folder for trained models", required=True)
args = args.parse_args()

# Import TensorFlow
import tensorflow as tf

# Import training modules
import train_combined_openness
import train_combined_pitchyaw
import train_left_openness
import train_left_pitchyaw
import train_right_openness
import train_right_pitchyaw
import train_combined_openness_gen_2
import train_combined_openness_gen_2_scalable
import train_left_openness_combined_distillation
import train_right_openness_combined_distillation
import train_left_openness_gen_2
import train_right_openness_gen_2

# Global task queue
task_queue = queue.Queue()

# Global variables for input and output paths
input_dataset = None
output_folder = None

def run_training(python_file, module, output_file, input_model=None):
    """
    Abstracted training call that:
      1. Sets system arguments (--db_path, --output_dir, and optionally --input_model_path)
      2. Calls the module's main() function
      3. Clears the TensorFlow session and collects garbage.
      
    :param python_file: Name of the training python file.
    :param module: The imported module that contains a main() function.
    :param output_file: Expected output file name (for logging purposes).
    :param input_model: Optional; if provided, a command line argument "--input_model_path"
                        will be added with this value.
    """
    print(f"\nRunning {python_file} to generate {output_file}...")
    # Backup the current sys.argv
    old_argv = sys.argv[:]
    
    # Base arguments
    sys.argv = [
        python_file,
        "--db_path", input_dataset,
        "--output_dir", output_folder
    ]
    
    # Optionally add the input_model argument
    if input_model is not None:
        sys.argv += ["--input_model_path", os.path.join(output_folder, input_model)]
    
    try:
        module.main()
    except SystemExit as e:
        # Catch sys.exit calls in the training module
        print(f"{python_file} exited with code: {e.code}")
    finally:
        # Clear TensorFlow session and force garbage collection
        tf.keras.backend.clear_session()
        gc.collect()
        print(f"Cleaned up resources after running {python_file}.")
        
    sys.argv = old_argv

def task_handler(task_name):
    print(f"Task '{task_name}' started.")
    # Map the task name to a (python_file, module, output_file) tuple
    if task_name == "Combined Gaze":
        run_training("train_combined_pitchyaw.py", train_combined_pitchyaw, "combined_pitchyaw.h5")
    elif task_name == "Left Gaze":
        run_training("train_left_pitchyaw.py", train_left_pitchyaw, "left_pitchyaw.h5")
    elif task_name == "Right Gaze":
        run_training("train_right_pitchyaw.py", train_right_pitchyaw, "right_pitchyaw.h5")
    elif task_name == "Combined Openness":
        run_training("train_combined_openness.py", train_combined_openness, "combined_openness.h5")
    elif task_name == "Left Openness":
        run_training("train_left_openness.py", train_left_openness, "left_openness.h5")
    elif task_name == "Right Openness":
        run_training("train_right_openness.py", train_right_openness, "right_openness.h5")
    elif task_name == "Combined Openness Gen 2":
        run_training("train_combined_openness_gen_2.py", train_combined_openness_gen_2, "combined_openness_gen2.h5", "combined_openness.h5")
    elif task_name == "Scalable Combined Openness Gen 2":
        run_training("train_combined_openness_gen_2_scalable.py", train_combined_openness_gen_2_scalable, "combined_openness_gen2.h5", "combined_openness.h5")
    elif task_name == "Left Openness Gen 2":
        run_training("train_left_openness_gen_2.py", train_left_openness_gen_2, "left_openness_gen_2.h5", "left_openness.h5")
    elif task_name == "Right Openness Gen 2":
        run_training("train_right_openness_gen_2.py", train_right_openness_gen_2, "right_openness_gen_2.h5", "right_openness.h5")
    elif task_name == "Left Openness / Combined Gen 2 Distillation":
        run_training("train_left_openness_combined_distillation.py", train_left_openness_combined_distillation, "left_openness_distilled.h5", "combined_openness.h5")
    elif task_name == "Right Openness / Combined Gen 2 Distillation":
        run_training("train_right_openness_combined_distillation.py", train_right_openness_combined_distillation, "right_openness_distilled.h5", "combined_openness.h5")
    else:
        print(f"No training function defined for '{task_name}'.")
    print(f"Task '{task_name}' finished.")

input_dataset = args.db_path
output_folder = args.output_dir

# Create inquirer questions
questions = [
    Checkbox("tasks", message="Select the models to train", choices=[
        "Combined Gaze",
        "Combined Openness",
        "Left Gaze",
        "Left Openness",
        "Right Gaze",
        "Right Openness",
        "Combined Openness Gen 2",
        "Scalable Combined Openness Gen 2",
        "Left Openness / Combined Gen 2 Distillation",
        "Right Openness / Combined Gen 2 Distillation",
        "Left Openness Gen 2",
        "Right Openness Gen 2"
    ])
]

# Get the chosen models
answers = prompt(questions)

# Print summary
print("Input Database:", input_dataset)
print("Output Folder:", output_folder)
print("Selected Models:")
for task in answers["tasks"]:
    print(f" - {task}")
    
# Wait for yes or no input
confirm = input("Start training? (y/n): ").lower() == "y"
if confirm:
    for task in answers["tasks"]:
        task_handler(task)
else:
    print("Training cancelled.")
    raise SystemExit()
print("All selected tasks have been queued and processed.")