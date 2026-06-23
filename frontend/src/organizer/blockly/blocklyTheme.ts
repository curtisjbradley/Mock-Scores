import * as Blockly from 'blockly';

const darkTheme = Blockly.Theme.defineTheme('dark', {
  name: 'dark',
  base: Blockly.Themes.Classic,
  componentStyles: {
    workspaceBackgroundColour: '#1a1d27',
    toolboxBackgroundColour: '#22263a',
    toolboxForegroundColour: '#e8eaf6',
    flyoutBackgroundColour: '#22263a',
    flyoutForegroundColour: '#e8eaf6',
    flyoutOpacity: 1,
    scrollbarColour: '#4a5280',
  },
});

export function getTheme(): Blockly.Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? darkTheme
    : Blockly.Themes.Classic;
}

export function watchTheme(workspaces: () => Blockly.WorkspaceSvg[]): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => {
    const theme = getTheme();
    for (const ws of workspaces()) ws.setTheme(theme);
  };
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}
