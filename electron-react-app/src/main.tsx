// src/main.tsx

/**
 * Main Entry Point
 *
 * This file bootstraps the Eye Tracking application by setting up the React application with Redux,
 * state persistence, and essential background services. It also applies the current theme to the
 * document and adds a parallax background effect when a specific theme is active.
 *
 * The application is rendered into the DOM element with id "root".
 */

import React, { useEffect, useRef } from "react";
import ReactDOM from "react-dom/client";
import { Provider, useSelector } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import App from "./App";
import store, { persistor } from "./store";
import { startCameraService } from "./services/cameraService";
import { startThetaService } from "./services/thetaService";
import { startTrainingDataService } from "./services/trainingDataService";
import { startTrackingComputation } from "./services/trackingComputationService";
import { startOpennessComputation } from "./services/opennessComputationService";
import "./styles/global.css";

/**
 * ThemeProvider Component
 *
 * This component applies the current theme (from the Redux store) to the document and
 * adds a parallax background effect when a background image is provided.
 *
 * It updates the "data-theme" attribute on the root element and listens for mouse movement
 * events to adjust the background position, creating a dynamic parallax effect.
 */
const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const currentTheme = useSelector((state: any) => state.config.theme);
  const backgroundImageUrl = useSelector((state: any) => state.config.backgroundImageUrl);

  // Update the document's theme attribute when the theme changes.
  useEffect(() => {
    // Update the data-theme attribute
    document.documentElement.setAttribute("data-theme", currentTheme);
  }, [currentTheme]);

  // Apply the ninaboo theme background and parallax effect.
  useEffect(() => {
    if (backgroundImageUrl != "") {

      // Set the background image along with the gradient overlay and other properties.
      if (currentTheme === "ninaboo") {
        document.body.style.background = `
          linear-gradient(165deg,
            rgba(var(--nina-gradient-color-1), 0.2),
            rgba(var(--nina-gradient-color-2), 0.5),
            rgba(var(--nina-gradient-color-3), 0.5)
          ),
          url("${backgroundImageUrl}")
        `;
      } else if (currentTheme === "trans") {
        document.body.style.background = `
        linear-gradient(180deg,
          rgba(var(--trans-gradient-color-1), 0.9), 
          rgba(var(--trans-gradient-color-2), 0.8),
          rgba(var(--trans-gradient-color-3), 0.6),  
          rgba(var(--trans-gradient-color-2), 0.8),
          rgba(var(--trans-gradient-color-1), 0.9)
        ),
        url("${backgroundImageUrl}")
        `;
      } else {
        document.body.style.background = `
        linear-gradient(rgb(0, 0, 0, 0.75), rgba(0, 0, 0, 0.75)),
        url("${backgroundImageUrl}")
      `;
      }
      document.body.style.backgroundSize = 'calc(100% + 50px) calc(100% + 50px), calc(100% + 50px) calc(100% + 50px)';
      document.body.style.backgroundRepeat = 'no-repeat';
      document.body.style.backgroundAttachment = 'fixed';
      // Set an initial background position that will be dynamically updated by the parallax effect.
      document.body.style.backgroundPosition = 'center, 50% 50%';

      // Parallax background effect handler.
      const handleMouseMove = (e: MouseEvent) => {
        const xFraction = Math.min(1, Math.max(0, e.clientX / window.innerWidth));
        const yFraction = Math.min(1, Math.max(0, e.clientY / window.innerHeight));

        // Scale the maximum offset proportionally based on the smallest dimension.
        const minDimension = Math.min(window.innerWidth, window.innerHeight);
        const maxOffset = minDimension >= 1000 ? 50 : 50 * (minDimension / 1000);
        const offsetX = (0.5 - xFraction) * maxOffset;
        const offsetY = (0.5 - yFraction) * maxOffset;

        // Update the background position to create the parallax effect.
        document.body.style.backgroundPosition = `calc(50% + ${offsetX}px) calc(50% + ${offsetY}px)`;
      };

      window.addEventListener("mousemove", handleMouseMove);

      // Clean up the event listener and reset the background on unmount.
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        document.body.style.background = "";
      };
    } else {
      // If no background image, then leave a blank background.
      document.body.style.background = "";
    }
  }, [currentTheme, backgroundImageUrl]);

  return <>{children}</>;
};

/**
 * Initializer Component
 *
 * This component starts the required background services (camera, theta, training data,
 * and tracking computation) only once when the application loads.
 *
 * It uses React's useRef hook to ensure that each service is started only a single time.
 */
const Initializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const cameraServiceStarted = useRef(false);
  const thetaServiceStarted = useRef(false);
  const trainingDataServiceStarted = useRef(false);
  const trackingComputationServiceStarted = useRef(false);
  const opennessComputationServiceStarted = useRef(false);

  // Start each service if it hasn't been started yet.
  useEffect(() => {
    if (!cameraServiceStarted.current) {
      startCameraService();
      cameraServiceStarted.current = true;
    }
    if (!thetaServiceStarted.current) {
      startThetaService();
      thetaServiceStarted.current = true;
    }
    if (!trainingDataServiceStarted.current) {
      startTrainingDataService();
      trainingDataServiceStarted.current = true;
    }
    if (!trackingComputationServiceStarted.current) {
      startTrackingComputation();
      trackingComputationServiceStarted.current = true;
    }
    if (!opennessComputationServiceStarted.current) {
      startOpennessComputation();
      opennessComputationServiceStarted.current = true;
    }
  }, []);

  return <>{children}</>;
};

// Render the application into the DOM element with id "root".
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <Initializer>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </Initializer>
      </PersistGate>
    </Provider>
  </React.StrictMode>
);