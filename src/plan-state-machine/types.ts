/**
 * Plan State Machine Types
 *
 * Manages the interactive planning workflow with navigation options
 */

import { FFTPlanOption, FFTPlanResult } from '../fft/types';

/**
 * Planning states
 */
export enum PlanState {
  ANALYZING = 'analyzing',                   // FFT is analyzing the task
  OPTION_SELECTION = 'option_selection',     // User selects from multiple options (complex tasks)
  PLAN_CONFIRMATION = 'plan_confirmation',   // User confirms the selected plan before execution
  EXECUTING = 'executing',                   // Plan is being executed
  COMPLETED = 'completed',                   // Execution completed
  CANCELLED = 'cancelled',                   // User cancelled the planning
}

/**
 * Navigation actions available at each state
 */
export enum NavigationAction {
  CONTINUE = 'continue',                     // Proceed to next state
  BACK = 'back',                             // Go back to previous state
  REGENERATE = 'regenerate',                 // Generate new options (complex tasks only)
  CONFIRM = 'confirm',                       // Confirm and execute
  EXIT = 'exit',                             // Exit planning flow
}

/**
 * State history entry for back navigation
 */
export interface StateHistoryEntry {
  state: PlanState;
  timestamp: number;
  data?: any;  // State-specific data (e.g., options, selected plan)
}

/**
 * Plan context - carries data through the state machine
 */
export interface PlanContext {
  requirement: string;
  projectInfo: Record<string, string>;
  fftResult?: FFTPlanResult;
  selectedOption?: FFTPlanOption;
  allOptions?: FFTPlanOption[];  // Keep all options for re-selection
}

/**
 * State machine configuration
 */
export interface StateMachineConfig {
  allowRegenerate: boolean;  // Allow generating new options
  maxRegenerations: number;   // Max times user can regenerate options
}

/**
 * State transition result
 */
export interface StateTransition {
  nextState: PlanState;
  action: NavigationAction;
  shouldExit: boolean;
}

/**
 * Navigation menu item
 */
export interface NavigationMenuItem {
  key: string;
  label: string;
  description: string;
  action: NavigationAction;
  emoji: string;
}

/**
 * State machine result
 */
export interface StateMachineResult {
  state: PlanState;
  planToExecute?: FFTPlanOption;
  cancelled: boolean;
}
