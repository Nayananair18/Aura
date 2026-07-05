import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { CaptureScreen } from '../screens/CaptureScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ResultScreen } from '../screens/ResultScreen';
import { VerificationScreen } from '../screens/VerificationScreen';

const Stack = createNativeStackNavigator();

export const RootNavigator = ({ theme }) => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen 
          name="Home" 
          options={{ title: 'Home' }}
        >
          {(props) => <HomeScreen {...props} theme={theme} />}
        </Stack.Screen>

        <Stack.Screen 
          name="Capture"
          options={{ title: 'Capture Media', animationEnabled: true }}
        >
          {(props) => <CaptureScreen {...props} theme={theme} />}
        </Stack.Screen>

        <Stack.Screen 
          name="Verify"
          options={{ title: 'Verify Media', animationEnabled: true }}
        >
          {(props) => <VerificationScreen {...props} theme={theme} />}
        </Stack.Screen>

        <Stack.Screen 
          name="Result"
          options={{ title: 'Result', animationEnabled: true }}
        >
          {(props) => <ResultScreen {...props} theme={theme} />}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
};
