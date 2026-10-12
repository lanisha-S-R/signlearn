// messageReducer.js - the message being composed, with undo.
export const MAX_HISTORY = 200;
export const initialMessage = { text: "", history: [] };

function commit(state, text) {
  if (text === state.text) return state;
  const history = [...state.history, state.text].slice(-MAX_HISTORY);
  return { text, history };
}

export function messageReducer(state, action) {
  switch (action.type) {
    case "append": return commit(state, state.text + action.value);
    case "space": return state.text.endsWith(" ") || state.text === "" ? state : commit(state, state.text + " ");
    case "backspace": return state.text ? commit(state, state.text.slice(0, -1)) : state;
    case "clear": return commit(state, "");
    case "set": return commit(state, action.value);
    case "undo": {
      if (!state.history.length) return state;
      const history = state.history.slice(0, -1);
      return { text: state.history[state.history.length - 1], history };
    }
    default: return state;
  }
}
