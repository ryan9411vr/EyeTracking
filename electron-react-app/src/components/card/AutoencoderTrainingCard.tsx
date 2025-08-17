// src/components/card/AutoencoderTrainingCard.tsx
import React from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { setOutputConvertedModelPath, setOutputTrainedModelPath } from '../../slices/configSlice';
import TrainCombinedAutoencoderCheckboxMolecule from '../molecules/checkboxes/TrainCombinedAutoencoderCheckboxMolecule';
import TrainLeftAutoencoderCheckboxMolecule from '../molecules/checkboxes/TrainLeftAutoencoderCheckboxMolecule';
import TrainRightAutoencoderCheckboxMolecule from '../molecules/checkboxes/TrainRightAutoencoderCheckboxMolecule';
import ConvertCombinedAutoencoderCheckboxMolecule from '../molecules/checkboxes/ConvertCombinedAutoencoderCheckboxMolecule';
import ConvertLeftAutoencoderCheckboxMolecule from '../molecules/checkboxes/ConvertLeftAutoencoderCheckboxMolecule';
import ConvertRightAutoencoderCheckboxMolecule from '../molecules/checkboxes/ConvertRightAutoencoderCheckboxMolecule';
import OutputTrainedModelPathMolecule from '../molecules/OutputTrainedModelPathMolecule';
import OutputConvertedModelPathMolecule from '../molecules/OutputConvertedModelPathMolecule';
import SelectTrainedModelOutputPathButtonMolecule from '../molecules/buttons/SelectTrainedModelOutputPathButtonMolecule';
import SelectConvertedModelOutputPathButtonMolecule from '../molecules/buttons/SelectConvertedModelOutputPathButtonMolecule';
import RunAutoencoderTrainingButtonMolecule from '../molecules/buttons/RunAutoencoderTrainingButtonMolecule';
import store from '../../store';

const AutoencoderTrainingCard: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const handleSelectTrainedModelOutputPath = async () => {
    try {
      const folderPath = await window.electronAPI.selectFolder();
      if (folderPath) {
        dispatch(setOutputTrainedModelPath(folderPath));
      }
    } catch (error) {
      console.error(t('AutoencoderTrainingCard.errorSelectingPath'), error);
    }
  };

  const handleSelectConvertedModelOutputPath = async () => {
    try {
      const folderPath = await window.electronAPI.selectFolder();
      if (folderPath) {
        dispatch(setOutputConvertedModelPath(folderPath));
      }
    } catch (error) {
      console.error(t('AutoencoderTrainingCard.errorSelectingPath'), error);
    }
  };

  const handleRunAutoencoderTraining = async () => {

    let configState = store.getState().config;
    let dbState = store.getState().database;
    
    await window.electronAPI.runAutoencoderTraining({
      convertCombined: configState.convertCombinedAutoencoder,
      convertLeft: configState.convertLeftAutoencoder,
      convertRight: configState.convertRightAutoencoder,
      trainCombined: configState.trainCombinedAutoencoder,
      trainLeft: configState.trainLeftAutoencoder,
      trainRight: configState.trainRightAutoencoder,
      convertedModelOutputPath: configState.outputConvertedModelPath,
      trainedModelOutputPath: configState.outputTrainedModelPath,
      dbPath: dbState.selectedDb,
    });
  };

  return (
    <div className="card mb-1">
      <div className="card-header text-header-color text-header">
        <span className="status-title">{t('AutoencoderTrainingCard.header')}</span>
      </div>
      <div className="text-normal text-left text-standard-color text-center">
        <OutputTrainedModelPathMolecule />
        <OutputConvertedModelPathMolecule />
        <div className="flex-label space-between w-50 mt-1 mb-1">
          <div className="grid-column">
            <TrainCombinedAutoencoderCheckboxMolecule />
            <TrainLeftAutoencoderCheckboxMolecule />
            <TrainRightAutoencoderCheckboxMolecule />
          </div>
          <div className="grid-column">
            <ConvertCombinedAutoencoderCheckboxMolecule />
            <ConvertLeftAutoencoderCheckboxMolecule />
            <ConvertRightAutoencoderCheckboxMolecule />
          </div>
        </div>
        <SelectTrainedModelOutputPathButtonMolecule onSelectTrainedModelOutputPath={handleSelectTrainedModelOutputPath} />
        <SelectConvertedModelOutputPathButtonMolecule onSelectConvertedModelOutputPath={handleSelectConvertedModelOutputPath} />
        <RunAutoencoderTrainingButtonMolecule onRunAutoencoderTraining={handleRunAutoencoderTraining} />
      </div>
    </div>
  );
};

export default AutoencoderTrainingCard;
