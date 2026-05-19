import { colors } from './colors';
import { spacing } from './spacing';
import { typography } from './typography';

export const lightTheme = {
  colors: colors.light,
  spacing,
  typography,
};

export const darkTheme = {
  colors: colors.dark,
  spacing,
  typography,
};

export const getTheme = (isDark = false) => {
  return isDark ? darkTheme : lightTheme;
};
