const { saveUserProfile, getUserProfile } = require("./service");
const logger = require("../lib/logger");

// Onboarding states
const STATES = {
  ASK_NAME: "ask_name",
  ASK_EMAIL: "ask_email",
  ASK_PHONE: "ask_phone",
  DONE: "done",
};

// Store onboarding state per user
const onboardingStates = new Map(); // uid -> { state, data }

/**
 * Get current onboarding state for user
 * @param {string} uid - User ID
 * @returns {Object} - Current state and collected data
 */
function getOnboardingState(uid) {
  return onboardingStates.get(uid) || { state: STATES.DONE, data: {} };
}

/**
 * Set onboarding state for user
 * @param {string} uid - User ID
 * @param {string} state - New state
 * @param {Object} data - Additional data to store
 */
function setOnboardingState(uid, state, data = {}) {
  const current = getOnboardingState(uid);
  onboardingStates.set(uid, {
    state,
    data: { ...current.data, ...data },
  });
}

/**
 * Try to handle user message in onboarding flow
 * @param {string} uid - User ID
 * @param {string} text - User message
 * @returns {Object|null} - Response message and next state, or null if not in onboarding
 */
async function tryHandle(uid, text) {
  const current = getOnboardingState(uid);

  // If not in onboarding, return null
  if (current.state === STATES.DONE) {
    return null;
  }

  const trimmedText = text.trim();

  switch (current.state) {
    case STATES.ASK_NAME:
      if (trimmedText.length < 2) {
        return {
          message: "Please provide your full name (at least 2 characters).",
          state: STATES.ASK_NAME,
        };
      }

      setOnboardingState(uid, STATES.ASK_EMAIL, { name: trimmedText });
      return {
        message: `Nice to meet you, ${trimmedText}! What's your email address?`,
        state: STATES.ASK_EMAIL,
      };

    case STATES.ASK_EMAIL:
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedText)) {
        return {
          message: "Please provide a valid email address.",
          state: STATES.ASK_EMAIL,
        };
      }

      setOnboardingState(uid, STATES.ASK_PHONE, { email: trimmedText });
      return {
        message:
          "Great! What's your phone number? (You can skip this if you prefer)",
        state: STATES.ASK_PHONE,
      };

    case STATES.ASK_PHONE:
      // Phone is optional, so accept anything or skip
      const phone = trimmedText.toLowerCase() === "skip" ? "" : trimmedText;

      // Save the complete profile
      const profileData = { ...current.data, phone };
      await saveUserProfile(uid, profileData);

      // Mark onboarding as complete
      setOnboardingState(uid, STATES.DONE);

      logger.info("User onboarding completed", { uid, profileData });

      return {
        message: `Perfect! Welcome ${profileData.name}! 🎉\n\nYou can now:\n• Type "connect" to link your Google Calendar\n• Type "agenda" to see your daily schedule\n• Type "help" for more commands`,
        state: STATES.DONE,
      };

    default:
      return null;
  }
}

/**
 * Start onboarding flow for a user
 * @param {string} uid - User ID
 * @returns {Object} - Initial message and state
 */
function startOnboarding(uid) {
  setOnboardingState(uid, STATES.ASK_NAME);
  return {
    message:
      "Welcome! 👋 I'm your WhatsApp productivity assistant.\n\nTo get started, what's your name?",
    state: STATES.ASK_NAME,
  };
}

/**
 * Check if user is currently in onboarding
 * @param {string} uid - User ID
 * @returns {boolean} - true if user is in onboarding flow
 */
function isInOnboarding(uid) {
  const state = getOnboardingState(uid);
  return state.state !== STATES.DONE;
}

module.exports = {
  tryHandle,
  startOnboarding,
  isInOnboarding,
  STATES,
};
