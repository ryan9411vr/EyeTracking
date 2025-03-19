// src/store.ts

/**
 * Redux Store Configuration
 *
 * This module configures the Redux store using Redux Toolkit and sets up state
 * persistence via redux-persist. It combines reducers from various slices and
 * applies a persist configuration to store only selected slices ("config" and "database").
 */

import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer, createMigrate } from 'redux-persist';
import storage from 'redux-persist/lib/storage';

import statusReducer from './slices/statusSlice';
import configReducer, { initialState as configInitialState } from './slices/configSlice';
import databaseReducer, { initialState as databaseInitialState } from './slices/databaseSlice';

const migrations = {
  1: (state: any) => {
    return {
      ...state,
      config: {
        ...configInitialState,
        ...state.config,
      },
      database: {
        ...databaseInitialState,
        ...state.database,
      },
    };
  },
};

/**
 * Persistence configuration for redux-persist.
 *
 * Specifies the key, storage engine, version, migration strategy,
 * and a whitelist of slices to persist.
 */
const persistConfig = {
  key: 'root',
  version: 1, // If incremented, you'll need to add more migration steps.
  storage,
  whitelist: ['config', 'database'],
  migrate: createMigrate(migrations, { debug: false }),
};

/**
 * Combines individual slice reducers into a single root reducer.
 */
const rootReducer = combineReducers({
  status: statusReducer,
  config: configReducer,
  database: databaseReducer,
});

/**
 * Enhances the root reducer with persistence capabilities.
 */
const persistedReducer = persistReducer(persistConfig, rootReducer);

/**
 * Configures the Redux store with the persisted reducer and custom middleware.
 * The middleware configuration ignores specific redux-persist actions
 * during serializable checks to avoid warnings.
 */
const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
});

/**
 * Creates a persistor which manages the persisted state of the store.
 */
export const persistor = persistStore(store);

/**
 * Exports types for the application's root state and dispatch function.
 */
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
