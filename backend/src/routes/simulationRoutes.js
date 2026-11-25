const express = require('express');
const router = express.Router();
const { optionalFirebaseToken } = require('../middleware/authMiddleware');
const {
  startSimulation,
  getSimulationState,
  getSimulationRecommendations,
  listSimulations,
  advanceSimulationStep,
  runFullSimulation,
  pauseSimulation,
  resumeSimulation,
  endSimulation,
  restartSimulation,
  exportSimulation,
  handleDeadlockResolutionAction,
} = require('../controllers/simulationController');

// Routes
router.post('/start', startSimulation);
router.get('/', listSimulations);
router.get('/:id/recommendations', getSimulationRecommendations);
router.get('/:id', getSimulationState);
router.get('/:id/export', exportSimulation);
router.post('/:id/step', advanceSimulationStep);
router.post('/:id/run', runFullSimulation);
router.post('/:id/pause', pauseSimulation);
router.post('/:id/resume', resumeSimulation);
router.post('/:id/end', endSimulation);
router.post('/:id/restart', restartSimulation);

module.exports = router;
