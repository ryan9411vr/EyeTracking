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

    // Data class used for JSON serialization.
    [System.Serializable]
    public class ThetaData
    {
        public float theta1;
        public float theta2;
        public bool record;       // True if both grips are held for at least 1 sec.
        public bool deleteRecent; // True for one frame when right controller primary button is pressed.
        public float openness;    // Unused. Left in just in case.
        public string mode;       // "gaze"- only supported value.
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
        ComputeDisplayAndBroadcastThetas();

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
            openness = 0f, // Not used. Left in just in case though.
            mode = "gaze"
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
