// Permet d'importer des fichiers .svg comme composants React (svg-transformer).
declare module '*.svg' {
  import type React from 'react';
  import type { SvgProps } from 'react-native-svg';
  const Component: React.FC<SvgProps>;
  export default Component;
}
