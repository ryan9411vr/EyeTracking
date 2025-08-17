// src/components/page/DatabasePage.tsx

/**
 * The database page contains cards for selecting / creating your training database, 
 * configuring training parameters, validating data flow, and for loading a tracking model. 
 */

import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { RootState, AppDispatch } from "../../store";
import {
  setSelectedDatabase,
  createDatabaseAsync,
  deleteDatabase,
  setFileExists,
  setShowDialog,
  setEntryCount,
} from "../../slices/databaseSlice";
import CustomDialog from "../misc/CreateNewDatabaseDialog";
import ThetaFlagsCard from "../card/ThetaFlagsCard";
import ModelSelectionCard from "../card/ModelSelectionCard";
import RecordTrainingDataCard from "../card/TrainingDataRecordingCard";
import DatabaseSelectionCard from "../card/DatabaseSelectionCard";
import GazeHeatmapCard from "../card/GazeHeatmapCard";
import AutoencoderTrainingCard from "../card/AutoencoderTrainingCard";

const DatabasePage: React.FC = () => {
  const { t } = useTranslation();
  const dispatch: AppDispatch = useDispatch();
  const selectedDb = useSelector((state: RootState) => state.database.selectedDb);
  const fileExists = useSelector((state: RootState) => state.database.fileExists);
  const showDialog = useSelector((state: RootState) => state.database.showDialog);

  useEffect(() => {
    const checkFileExists = async () => {
      if (selectedDb && selectedDb.endsWith(".db")) {
        const exists = await window.electronAPI.fileExists(selectedDb);
        dispatch(setFileExists(exists));
      } else {
        dispatch(setFileExists(false));
      }
    };
    checkFileExists();
  }, [selectedDb, dispatch]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    const fetchEntryCount = async () => {
      if (selectedDb && fileExists) {
        try {
          const count = await window.electronAPI.countTrainingData(selectedDb);
          dispatch(setEntryCount(count));
        } catch (error) {
          console.error("Error fetching training data count:", error);
          dispatch(setEntryCount(null));
        }
      } else {
        dispatch(setEntryCount(null));
      }
    };
    fetchEntryCount();
    intervalId = setInterval(fetchEntryCount, 1000);
    return () => clearInterval(intervalId);
  }, [selectedDb, fileExists, dispatch]);

  const isValidFilename = (name: string): boolean => {
    const trimmed = name.trim();
    if (trimmed === "") return false;
    if (trimmed.includes("/") || trimmed.includes("\\")) return false;
    return true;
  };

  const handleDialogConfirm = async (dbName: string) => {
    if (!isValidFilename(dbName)) {
      window.alert(t("DatabasePage.invalidDatabaseNameAlert"));
      window.electronAPI.focusFix();
      return;
    }
    try {
      const folderPath = await window.electronAPI.selectFolder();
      if (folderPath) {
        const fullPath = `${folderPath}/${dbName.trim()}.db`;
        await dispatch(createDatabaseAsync(fullPath)).unwrap();
      } else {
        window.alert(t("DatabasePage.noFolderSelectedAlert"));
        window.electronAPI.focusFix();
      }
    } catch (error) {
      console.error("Error creating database:", error);
      window.alert(t("DatabasePage.errorCreatingDatabaseAlert"));
      window.electronAPI.focusFix();
    }
    dispatch(setShowDialog(false));
  };

  const handleDialogCancel = () => {
    dispatch(setShowDialog(false));
  };

  const handleSelectDatabase = async () => {
    try {
      const filePath = await window.electronAPI.selectFile({
        filters: [{ name: "SQLite Database", extensions: ["db"] }],
      });
      if (filePath) {
        dispatch(setSelectedDatabase(filePath));
      }
    } catch (error) {
      console.error("Error selecting database:", error);
    }
  };

  const handleDeleteDatabase = async () => {
    if (!selectedDb || !selectedDb.endsWith(".db")) return;
    const confirmed = window.confirm(t("DatabasePage.confirmDeleteDatabase"));
    if (!confirmed) return;
    try {
      await window.electronAPI.deleteFile(selectedDb);
      dispatch(deleteDatabase());
    } catch (error) {
      console.error("Error deleting database:", error);
    }
  };

  return (
    <div className="page-container">
      <DatabaseSelectionCard
        onCreate={() => dispatch(setShowDialog(true))}
        onSelect={handleSelectDatabase}
        onDelete={handleDeleteDatabase}
        disableDelete={!fileExists}
      />
      <div className="grid grid-auto-fit-280 mb-1">
        <RecordTrainingDataCard />
        <ThetaFlagsCard />
      </div>
      <ModelSelectionCard />
      {showDialog && (
        <CustomDialog
          message={t("DatabasePage.newDatabaseDialogMessage")}
          visible={showDialog}
          placeholder={t("DatabasePage.newDatabaseDialogPlaceholder")}
          onCancel={handleDialogCancel}
          onConfirm={handleDialogConfirm}
        />
      )}
      <AutoencoderTrainingCard />
      <div className="grid grid-auto-fill-280 mb-1">
        <GazeHeatmapCard />
      </div>
    </div>
  );
};

export default DatabasePage;
