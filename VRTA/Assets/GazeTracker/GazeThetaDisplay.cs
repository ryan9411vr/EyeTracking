using UnityEngine;
using TMPro;
using WebSocketSharp;
using WebSocketSharp.Server;
using UnityEngine.XR;

public class GazeThetaDisplay : MonoBehaviour
{
    // Scene object references.
    [Header("Scene References")]
    public GameObject mainCamera;
    public GameObject gazeTarget;
    public TMP_Text gazeReadoutText;

    // WebSocket server variables.
    private WebSocketServer wss;
    private int port = 5005;

    // VR input tracking.
    private float gripHoldTime = 0f;
    private bool recordFlag = false;
    private bool deleteRecentFlag = false;

    // Mode toggle: true = Mode1 (gaze), false = Mode2 (openness).
    private bool isMode1 = true;
    // Used to track the previous frame's B button state to detect a single press.
    private bool previousBButtonState = false;

    // Data class used for JSON serialization.
    [System.Serializable]
    public class ThetaData
    {
        public float theta1;
        public float theta2;
        public bool record;       // True if both grips are held for at least 1 sec.
        public bool deleteRecent; // True for one frame when right controller primary button is pressed.
        public float openness;    // New field for openness.
        public string mode;       // "gaze" or "openness".
    }

    // WebSocket behavior to handle theta data connections.
    public class ThetaWebSocketBehavior : WebSocketBehavior
    {
        protected override void OnOpen()
        {
            Debug.Log("A client connected to the theta WebSocket.");
        }
    }

    void Start()
    {
        // Find objects by name if not assigned in the Inspector.
        if (mainCamera == null)
            mainCamera = GameObject.Find("Main Camera");
        if (gazeTarget == null)
            gazeTarget = GameObject.Find("GazeTarget");
        if (gazeReadoutText == null)
        {
            GameObject textObj = GameObject.Find("GazeReadoutText");
            if (textObj != null)
                gazeReadoutText = textObj.GetComponent<TMP_Text>();
        }

        StartWebSocketServer();
    }

    void Update()
    {
        // --- Using Unity XR InputDevices API ---

        // Get the left and right hand controllers.
        InputDevice leftHand = InputDevices.GetDeviceAtXRNode(XRNode.LeftHand);
        InputDevice rightHand = InputDevices.GetDeviceAtXRNode(XRNode.RightHand);

        // Check for grip button on both controllers.
        bool leftGripHeld = false;
        bool rightGripHeld = false;
        if (leftHand.isValid)
            leftHand.TryGetFeatureValue(CommonUsages.gripButton, out leftGripHeld);
        if (rightHand.isValid)
            rightHand.TryGetFeatureValue(CommonUsages.gripButton, out rightGripHeld);

        if (leftGripHeld && rightGripHeld)
        {
            gripHoldTime += Time.deltaTime;
        }
        else
        {
            gripHoldTime = 0f;
        }
        recordFlag = gripHoldTime >= 1.0f;

        // Check for a single frame press of the right controller's primary button (commonly the "A" button).
        bool rightPrimaryPressed = false;
        if (rightHand.isValid)
            rightHand.TryGetFeatureValue(CommonUsages.primaryButton, out rightPrimaryPressed);
        if (rightPrimaryPressed)
        {
            deleteRecentFlag = true;
        }

        // --- Toggle between two modes when the "B" (secondary) button is pressed.
        bool rightSecondaryPressed = false;
        if (rightHand.isValid)
            rightHand.TryGetFeatureValue(CommonUsages.secondaryButton, out rightSecondaryPressed);
        // Toggle mode on the rising edge.
        if (rightSecondaryPressed && !previousBButtonState)
        {
            isMode1 = !isMode1;
            Debug.Log("Mode toggled to " + (isMode1 ? "gaze" : "openness"));
        }
        previousBButtonState = rightSecondaryPressed;

        // Call logic based on the current mode.
        if (isMode1)
        {
            ComputeDisplayAndBroadcastThetas();
        }
        else
        {
            ComputeOpennessAndBroadcast();
        }

        // Reset the deleteRecent flag so that it is only true for one frame.
        deleteRecentFlag = false;
    }

    void StartWebSocketServer()
    {
        wss = new WebSocketServer(port);
        wss.AddWebSocketService<ThetaWebSocketBehavior>("/theta");
        wss.Start();
        Debug.Log("WebSocket server started on ws://127.0.0.1:" + port + "/theta");
    }

    void ComputeDisplayAndBroadcastThetas()
    {
        // Compute theta values based on the relative position of the gaze target to the main camera.
        Vector3 localTargetPos = mainCamera.transform.InverseTransformPoint(gazeTarget.transform.position);
        string thetaOutput = "";

        if (localTargetPos.z <= 0)
        {
            thetaOutput = "Gaze target is behind the camera!";
            UpdateDisplay(thetaOutput);
            return;
        }

        float theta2 = Mathf.Atan2(localTargetPos.x, localTargetPos.z) * Mathf.Rad2Deg;
        float theta1 = -Mathf.Atan2(localTargetPos.y, localTargetPos.z) * Mathf.Rad2Deg;
        thetaOutput = string.Format("Pitch: {0:F2}°\nYaw: {1:F2}°", theta1, theta2);
        UpdateDisplay(thetaOutput);

        ThetaData data = new ThetaData
        {
            theta1 = theta1,
            theta2 = theta2,
            record = recordFlag,
            deleteRecent = deleteRecentFlag,
            openness = 0f,         // In gaze mode, openness is set to 0.
            mode = "gaze"
        };
        SendThetaData(data);
    }

    // ComputeOpennessAndBroadcast reads the right trigger value, scales openness,
    // displays the trigger's inverse value, and broadcasts the data.
    void ComputeOpennessAndBroadcast()
    {
        // Get the right-hand controller.
        InputDevice rightHand = InputDevices.GetDeviceAtXRNode(XRNode.RightHand);
        float triggerValue = 0f;
        if (rightHand.isValid)
        {
            rightHand.TryGetFeatureValue(CommonUsages.trigger, out triggerValue);
        }
        // Invert the trigger value so that 0 means fully pressed and 1 means not pressed at all.
        float displayValue = 1f - triggerValue;
        // Scale the openness: when displayValue is 1, openness should be 0.75; when 0, openness is 0.
        float opennessValue = displayValue * 0.75f;

        string output = "Right Trigger (inverted): " + displayValue.ToString("F2");
        UpdateDisplay(output);

        ThetaData data = new ThetaData
        {
            theta1 = 0f,
            theta2 = 0f,
            record = recordFlag,
            deleteRecent = deleteRecentFlag,
            openness = opennessValue,
            mode = "openness"
        };
        SendThetaData(data);
    }

    void UpdateDisplay(string output)
    {
        if (gazeReadoutText != null)
        {
            gazeReadoutText.text = output;
        }
    }

    void SendThetaData(ThetaData data)
    {
        if (wss == null || !wss.IsListening)
        {
            Debug.LogWarning("WebSocket server not running. Unable to send theta data.");
            return;
        }

        string json = JsonUtility.ToJson(data);
        wss.WebSocketServices["/theta"].Sessions.Broadcast(json);
    }

    void OnApplicationQuit()
    {
        if (wss != null)
        {
            wss.Stop();
            Debug.Log("WebSocket server stopped.");
        }
    }
}
