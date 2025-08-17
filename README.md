# Eye Tracking

This project is the client application for a self-trained, machine learning-based eye tracking system for VRChat.

# Info

This project and the related repositories allow you to build a database of images and tracking data for your gaze and eye openness, then train machine learning models on that database, and finally use those models for customized tracking suited to your face, eyes, and hardware. The project is compatible with ETVR firmware.

# Benefits and Advantages

- Hardware running ETVR's OpenIris firmware. Supports WiFi, COM, and UVC. 

- Accurate tracking even with extreme camera angles using simultaneous predictions from two camera feeds.

- Rapid initial connections, automatic reconnection, and automatic fallback to single-eye tracking if one camera becomes disconnected.

- Supports both single-eye and dual-eye tracking.

- Use a merged view for combined gaze or eye openness analysis, or independent views for each eye.

- Supports output parameters compatible with VRC native, VRCFT v1, and VRCFT v2 standards.

# Contact

Discord: Ryan9411

Discord Server: https://discord.gg/QTyU4eNKrv

# Requirements

- Confirmed to work on 32GB of ram + 5090 on windows or linux. Minimum specs should be lower. It should work well on most systems but training will likely not work on AMD gpus or very old NVIDIA ones. For those who can't train you can have a user with a compatible system run the training for you. Inference at runtime is much simpler to run.

- Tested on Windows 11 and Ubuntu. Ubuntu currently works if built from source.

- ETVR firmware newer than March 2024.

# To Run

- Download the release and run the .exe to install the eye-tracking client. Keep the VRTA folder around as it contains a unity application you will need for gathering training data.

# Initial Setup

1) Open the **Status** page. Keep the **Headset Tracking** port at its default 5005.
2) Populate the **Left Eye Image Data** and/or **Right Eye Image Data** fields with the IP and Port of your eye trackers. COM ports can be entered as COM+Number, for example COM1. UVC ports are entered with a single number. Both of these can be found through the device manager in windows. IP and Port can be found through your router.
3) Enable the **Image Data - Left Eye** and/or **Image Data - Right Eye** status cards if they are forced offline by clicking them. If your trackers are online and broadcasting on the provided IP and Port, you should see the camera feed in the **Left Eye Camera** and/or **Right Eye Camera** cards.
4) Open the **Database** page. Click **Create New Database**, enter a filename, and then choose a directory.

# Data Gathering

1) Open the **VRTA** application. Allow network access if requested.
2) Under the **Status** page, verify **VR Headset Tracking** is online. If it is forced offline, click the card.
3) You have the following controls in the VRTA application:
   - Hold both grips for at least 1 second to start recording. You can verify this through the **Theta Flags** card. **Record** should switch to TRUE.
   - **A** on your right joystick should enable **Delete Recent** for a frame. This will delete the last 10 seconds of data. Use this if you catch your gaze wandering.
4) Under the **Database** page, enable **Record Training Data**.
5) In gaze mode, your objective is to stand a reasonable distance away, say at least 20 feet, stare at the dot, and move your head so you record your eye staring at the dot at an even distribution of head angles. Think of it like scanning a paper: turn your head in a line left to right, then up a tiny bit, then right to left, and so on. Repeat that pattern (or your own) to get a suitably sized training dataset. Make sure to get an even distribution over your field of vision and include samples at varying squinting levels. Blink normally. You can inspect the output distribution by clicking **Generate Heatmap for DB** at the bottom of the page. Note the output values on this image are flipped vertically. Aim for an even distribution, try to avoid large empty spots.
7) Record a suitable sample size. I use up to 20,000 images. You can supply more, but they will be randomly selected down to 20,000.

# Training (Windows)

1) Install WSL2. I use [Ubuntu 24.04.1 LTS](https://apps.microsoft.com/detail/9NZ3KLHXDJP5?hl=en-us&gl=US&ocid=pdpshare)
2) Run WSL2 (Start -> Ubuntu). You will be prompted for some first time setup. Follow the instructions there.
3) In WSL2, install [Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/). In WSL2's terminal, run the commands under **Set up Docker's apt repository**, **Install the Docker Packages**. Validate the install by running the command under **Verify that the installation is successful by running the "hello-world" image**. You can copy paste the commands.
4) In WSL2, run >```sudo usermod -aG docker $USER```
5) In WSL2, install [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html). Follow the steps for **With apt:Ubuntu, Debian**. Then follow the steps for **Configuring Docker**. As above, you can copy paste the commands.
6) If the above is done properly, the next steps will not error.
7) Go to the **Database** page in the eye tracking client. Go to the **Autoencoder Training Interface** card.
8) Select a folder where you would like your trained models to be placed. (Tensorflow .h5 models).
9) Select a folder where you would like your converted models to be placed. (Tensorflowjs format / Used by the client).
10) Switch the combination of the 6 toggles in that card depending on what you would like to train and convert. You must have a converted model for the client to work with. Simplest configuration is all 6 for a dual eye setup. For single eye, only enable the two toggles for that eye. On subsequent runs you may opt to only retrain one or more models.
11) Click **Run Autoencoder Training**. This will spawn a terminal which will pull and run docker images extended from NVIDIA's tensorflow compute container. Once pulled, it will run them and execute the training code for the models inside of them. This may take some time (hours). After training it will execute the conversion code. 

# Loading a Model and Running

1) Back in the client, on the **Database** page, use the **Model Selection** button to select a model folder.
2) Select the folder containing the 1–3 generated folders specified by **Converted Model Output Path**.
3) Switch to the **Tracking** tab.
4) Set your **OSC IP : Port**. It is likely `127.0.0.1:9000` unless you changed it. You shouldn't have to change this unless you run this on a remote computer or have changed the OSC port VRC uses through the command line.
5) Set your **VRCFT Prefix** if you have a VRCFT v2 avatar. You can find this in the debug panel of your avatar in VRC (examples include `""` (nothing), `"FT"`, `"ft/f"`, etc.). This is **EVERYTHING BEFORE THE "V2" IN THE PARAMETER PATH**. 
6) Toggle your output mode depending on your avatar: **VRC Native**, **VRCFT (v1)**, or **VRCFT (v2)**.
7) Enable the tracking you want:
   - **Eye Tracking**: enables eye tracking
   - **Eyelid Tracking**: enables eyelid tracking.
   - **Ind Eyes** and/or **Ind Eyelids**: enables separate tracking per eye for that data. Note: Independent eyelids can be very janky. 
8) If all is configured properly, you should see your eyes move in VR. You can view OSC messages using Protokol or the OSC debug window in VRC.

# Calibrating Blinking

1) Click **Calibrate - Closed** and close your eyes. You will hear a beep. Move your eyes around but keep them closed. Don't scrunch up your or eyes though. After 5 seconds you will hear another beep. You can open your eyes.
2) Click **Calibrate - Open** and hold your eyes open while looking around a little bit for 5 seconds. After the second beep, you can blink.
3) At this point the program will briefly lag as it quickly trains a neural network to detect if your eyes are open or shut. Once done the lag will end and you should see output in the slider at **Openness Configuration**.
4) Click **Calibrate - Slow Blink Sequence** and gently open and close your eyes about 5-6 times over 10 seconds until you hear the second beep. Do this smoothly.
5) The program will lag again as it trains a second neural network to determine a smooth eye openness value. You should see the output in **Openness Configuration** now move between open and closed with a better range. For inspection, you can view the **Calibration Plots** to see what this model is training off of. You want the grey (smoothed) line to go above the blue threshold and cross below it ONCE per blink and the same but in reverse for your eyes being closed. If you blinked say 5 times and see that the grey line has a different number of peaks, you should redo step 4, and maybe 1/2.
6) At this point blinking calibration should be done. This calibration will persist through restarts but you may find yourself wanting to change it. Recalibrating will overwrite the old calibration.
9) Tune the output to your preference. Play with smoothing settings and so on if you desire.
10) Enjoy tracking. If everything works well, from here on you simply need to start the application, turn on your trackers, and you are good to go.

# Linux

I have built this software and tested it on Linux. The steps above for training are generally valid with the exception that instead of WSL2 you just use your OS. You will probably want to build from source though. I haven't built the Unity app for linux though so that might be annoying. 

# Building from source

**Deps** - Versions are what I use locally

* node (v22.18.0)
* npm (10.9.3)
* docker (in WSL2 or in normal terminal). I use docker engine over docker desktop.
* python (3.13.7). After installing this run ```pip install setuptools```
* vs studio build tools (2022) (C++ Desktop Options) (needed for windows electron:build step). If you build the unity app you'll need more vscode stuff so you can just install the whole thing, just make sure you've got the C++ build tools. 
* enable developer mode (on windows)

Run ```npm install``` then ```npm run electron:build``` in the electron-react-app folder to build the client. Run ```npm run dev``` to run it in dev mode.

To build the docker images run ```docker build -f Dockerfile -t <imagename>:<tagname> .```. Then you'll want to reference those containers in electron-react-app\electron\training\autoencoderTrainer.ts. Sorry this is jank. I plan on fixing it. 

Building the unity side is an exercise left to the reader.

# Acknowledgements

**Ninaboo** - Help with themes, styling, localization, OSC parameters, avatar work and in game testing. Thanks for all the help!

**Thorinair** - UVC support.
