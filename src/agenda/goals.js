// Goals management for users
const memory = require("../store/memory");
const logger = require("../lib/logger");

/**
 * Add a goal for a user
 * @param {string} uid - User ID
 * @param {string} text - Goal text
 * @returns {Promise<number>} - Number of goals after adding
 */
async function addGoal(uid, text) {
  try {
    const goal = {
      text: text.trim(),
      completed: false,
      createdAt: new Date().toISOString()
    };
    
    const key = `user:${uid}:goals`;
    const count = await memory.rpush(key, goal);
    
    logger.info("Goal added", { uid, text: text.substring(0, 50), count });
    return count;
  } catch (error) {
    logger.error("Failed to add goal", error, { uid, text });
    throw error;
  }
}

/**
 * List all goals for a user
 * @param {string} uid - User ID
 * @returns {Promise<Array>} - Array of goals with their indices
 */
async function listGoals(uid) {
  try {
    const key = `user:${uid}:goals`;
    const goals = await memory.lrange(key);
    
    // Add index to each goal for easier reference
    const goalsWithIndex = goals.map((goal, index) => ({
      index,
      ...goal
    }));
    
    logger.info("Goals listed", { uid, count: goals.length });
    return goalsWithIndex;
  } catch (error) {
    logger.error("Failed to list goals", error, { uid });
    throw error;
  }
}

/**
 * Mark a goal as done by index
 * @param {string} uid - User ID
 * @param {number} index - Goal index (0-based)
 * @returns {Promise<boolean>} - True if goal was marked done, false if not found
 */
async function markDone(uid, index) {
  try {
    const key = `user:${uid}:goals`;
    const goals = await memory.lrange(key);
    
    if (index < 0 || index >= goals.length) {
      logger.warn("Goal index out of range", { uid, index, totalGoals: goals.length });
      return false;
    }
    
    const goal = goals[index];
    if (goal.completed) {
      logger.info("Goal already completed", { uid, index, text: goal.text });
      return false;
    }
    
    // Mark as completed
    goal.completed = true;
    goal.completedAt = new Date().toISOString();
    
    // Update the goal in the list
    const success = await memory.lset(key, index, goal);
    
    if (success) {
      logger.info("Goal marked as done", { uid, index, text: goal.text });
      return true;
    } else {
      logger.error("Failed to update goal completion status", { uid, index });
      return false;
    }
  } catch (error) {
    logger.error("Failed to mark goal as done", error, { uid, index });
    throw error;
  }
}

/**
 * Add interaction to user history (capped at 50)
 * @param {string} uid - User ID
 * @param {string} type - Interaction type (e.g., 'command', 'message')
 * @param {string} content - Interaction content
 * @returns {Promise<number>} - Number of history items after adding
 */
async function addToHistory(uid, type, content) {
  try {
    const interaction = {
      type,
      content: content.substring(0, 200), // Cap content length
      timestamp: new Date().toISOString()
    };
    
    const key = `user:${uid}:history`;
    const count = await memory.lpushCapped(key, interaction, 50);
    
    logger.debug("Interaction added to history", { uid, type, count });
    return count;
  } catch (error) {
    logger.error("Failed to add to history", error, { uid, type, content });
    // Don't throw - history is not critical
    return 0;
  }
}

/**
 * Get user interaction history
 * @param {string} uid - User ID
 * @param {number} limit - Maximum number of items to return (default: 10)
 * @returns {Promise<Array>} - Array of interactions
 */
async function getHistory(uid, limit = 10) {
  try {
    const key = `user:${uid}:history`;
    const history = await memory.lrange(key, 0, limit - 1);
    
    logger.debug("History retrieved", { uid, count: history.length, limit });
    return history;
  } catch (error) {
    logger.error("Failed to get history", error, { uid, limit });
    return [];
  }
}

module.exports = {
  addGoal,
  listGoals,
  markDone,
  addToHistory,
  getHistory
};