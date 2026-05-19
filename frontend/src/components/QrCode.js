import React from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

/**
 * A.U.R.A. Cryptographic QR Code Component
 */
export const QrCode = ({ 
  value, 
  size = 120, 
  theme, 
  logo = null 
}) => {
  const { colors } = theme;

  if (!value) return null;

  return (
    <View style={styles.container}>
      <View style={[styles.qrWrapper, { backgroundColor: '#FFFFFF' }]}>
        <QRCode
          value={value}
          size={size}
          color={colors.text}
          backgroundColor="#FFFFFF"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  qrWrapper: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
});
