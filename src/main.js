import { actions } from './game/state.js';
import { createScene } from './ui/scene.js';
import { initPanels } from './ui/panels.js';

actions.start();
const scene = createScene(document.getElementById('scene'));
initPanels({ onCamera: scene.setCamera });
