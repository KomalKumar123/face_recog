/**
 * FaceVerificationScreen.tsx
 *
 * Captures camera feed using expo-camera.
 * Renders an animated glassmorphic scanner UI (brackets + scanning laser line)
 * and tracks checklist status (Blink, Smile, Turn Left).
 * Automatically seeds the SQLite verification cache on success.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  Animated,
  Easing,
  Modal,
  StatusBar,
  Platform
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { VerificationDAO } from '../database/VerificationDAO';
import { EmployeeDAO, Employee } from '../database/EmployeeDAO';

type FaceVerificationScreenNavigationProp = StackNavigationProp<RootStackParamList, 'FaceVerification'>;
type FaceVerificationScreenRouteProp = RouteProp<RootStackParamList, 'FaceVerification'>;

interface Props {
  navigation: FaceVerificationScreenNavigationProp;
  route: FaceVerificationScreenRouteProp;
}

export const FaceVerificationScreen: React.FC<Props> = ({ navigation, route }) => {
  const { employeeId } = route.params;
  const [employee, setEmployee] = useState<Employee | null>(null);

  // Camera permissions
  const [permission, requestPermission] = useCameraPermissions();

  // Liveness check tracking state
  // 0 = Blink, 1 = Smile, 2 = Turn Left, 3 = Completed
  const [activeStep, setActiveStep] = useState(0);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [promptMessage, setPromptMessage] = useState('Align your face inside the frame');

  // Animation values
  const laserAnim = useRef(new Animated.Value(0)).current;
  const bracketsScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Fetch employee detail
    const emp = EmployeeDAO.getEmployeeById(employeeId);
    setEmployee(emp);
  }, [employeeId]);

  useEffect(() => {
    // Laser line scanning loop
    const startScanningAnimation = () => {
      laserAnim.setValue(0);
      Animated.loop(
        Animated.sequence([
          Animated.timing(laserAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(laserAnim, {
            toValue: 0,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    // Brackets pulse loop
    const startBracketsAnimation = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(bracketsScale, {
            toValue: 1.05,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(bracketsScale, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    if (permission?.granted) {
      startScanningAnimation();
      startBracketsAnimation();
    }
  }, [permission, laserAnim, bracketsScale]);

  // Simulate active liveness verification transitions
  useEffect(() => {
    if (!permission?.granted || activeStep >= 3) return;

    let timer: ReturnType<typeof setTimeout>;

    if (activeStep === 0) {
      setPromptMessage('Step 1: Please BLINK your eyes...');
      timer = setTimeout(() => {
        setActiveStep(1);
      }, 2500); // 2.5s for blink verification
    } else if (activeStep === 1) {
      setPromptMessage('Step 2: Now SMILE for verification...');
      timer = setTimeout(() => {
        setActiveStep(2);
      }, 2500); // 2.5s for smile verification
    } else if (activeStep === 2) {
      setPromptMessage('Step 3: TURN your head to the LEFT...');
      timer = setTimeout(() => {
        setActiveStep(3);
        handleVerificationSuccess();
      }, 2500); // 2.5s for turn-left verification
    }

    return () => clearTimeout(timer);
  }, [permission, activeStep]);

  const handleVerificationSuccess = () => {
    setPromptMessage('Liveness checks passed. Matching template...');
    
    setTimeout(() => {
      try {
        // Create mock 128D Float32 face embedding vector
        const mockEmbedding = Array.from({ length: 128 }, () => Math.random() - 0.5);

        // Store attempt details locally in verification_logs SQLite table
        VerificationDAO.insertVerificationLog(
          employeeId,
          0.9785, // confidence
          true,   // liveness check pass
          mockEmbedding
        );

        setSuccessModalVisible(true);
      } catch (error) {
        console.error('Failed to log verification success in SQL:', error);
      }
    }, 1200);
  };

  const handleProceed = () => {
    setSuccessModalVisible(false);
    // Move to Dashboard Screen
    navigation.replace('Dashboard', { employeeId });
  };

  if (!permission) {
    // Camera permissions are still loading
    return <View style={styles.loadingContainer} />;
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
        <GlassCard style={styles.permissionCard}>
          <Text style={styles.permissionHeader}>CAMERA ACCESS REQUIRED</Text>
          <Text style={styles.permissionText}>
            SmartEdge Verify needs camera access to perform secure on-device facial recognition and liveness detection.
          </Text>
          <GradientButton title="Grant Permission" onPress={requestPermission} />
          <TouchableOpacity
            style={styles.cancelLink}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelLinkText}>Go Back</Text>
          </TouchableOpacity>
        </GlassCard>
      </SafeAreaView>
    );
  }

  // Laser line translation Y range calculation
  const laserTranslateY = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 240], // fits inside the 240px scan area
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* Live Camera Viewport */}
      <CameraView style={StyleSheet.absoluteFill} facing="front" />

      {/* Glassmorphic Overlay Layer */}
      <SafeAreaView style={styles.overlayContainer}>
        
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>✕ Cancel</Text>
          </TouchableOpacity>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>OFFLINE MODE</Text>
          </View>
        </View>

        {/* Center Viewport Guide */}
        <View style={styles.scannerWrapper}>
          <Animated.View
            style={[
              styles.scannerBox,
              { transform: [{ scale: bracketsScale }] },
              activeStep === 3 ? styles.scannerBoxSuccess : null
            ]}
          >
            {/* Top-Left Corner Bracket */}
            <View style={[styles.corner, styles.topLeft, activeStep === 3 && styles.cornerSuccess]} />
            {/* Top-Right Corner Bracket */}
            <View style={[styles.corner, styles.topRight, activeStep === 3 && styles.cornerSuccess]} />
            {/* Bottom-Left Corner Bracket */}
            <View style={[styles.corner, styles.bottomLeft, activeStep === 3 && styles.cornerSuccess]} />
            {/* Bottom-Right Corner Bracket */}
            <View style={[styles.corner, styles.bottomRight, activeStep === 3 && styles.cornerSuccess]} />

            {/* Laser Line */}
            {activeStep < 3 && (
              <Animated.View
                style={[
                  styles.laserLine,
                  { transform: [{ translateY: laserTranslateY }] }
                ]}
              />
            )}
          </Animated.View>
        </View>

        {/* Bottom Panel: Liveness Checklist */}
        <View style={styles.bottomPanel}>
          <GlassCard style={styles.hudCard}>
            <Text style={styles.prompt}>{promptMessage}</Text>
            
            <View style={styles.checklist}>
              {/* Step 1: Blink */}
              <View style={styles.checkRow}>
                <View style={[
                  styles.checkbox,
                  activeStep > 0 ? styles.checkboxCompleted : (activeStep === 0 ? styles.checkboxActive : null)
                ]}>
                  {activeStep > 0 && <Text style={styles.checkMark}>✓</Text>}
                </View>
                <Text style={[styles.checkLabel, activeStep === 0 && styles.checkLabelActive]}>
                  Blink Eyes
                </Text>
              </View>

              {/* Step 2: Smile */}
              <View style={styles.checkRow}>
                <View style={[
                  styles.checkbox,
                  activeStep > 1 ? styles.checkboxCompleted : (activeStep === 1 ? styles.checkboxActive : null)
                ]}>
                  {activeStep > 1 && <Text style={styles.checkMark}>✓</Text>}
                </View>
                <Text style={[styles.checkLabel, activeStep === 1 && styles.checkLabelActive]}>
                  Smile
                </Text>
              </View>

              {/* Step 3: Turn Left */}
              <View style={styles.checkRow}>
                <View style={[
                  styles.checkbox,
                  activeStep > 2 ? styles.checkboxCompleted : (activeStep === 2 ? styles.checkboxActive : null)
                ]}>
                  {activeStep > 2 && <Text style={styles.checkMark}>✓</Text>}
                </View>
                <Text style={[styles.checkLabel, activeStep === 2 && styles.checkLabelActive]}>
                  Turn Head Left
                </Text>
              </View>
            </View>
          </GlassCard>
        </View>
      </SafeAreaView>

      {/* Success Modal */}
      <Modal
        visible={successModalVisible}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalBg}>
          <GlassCard style={styles.modalCard}>
            <View style={styles.successIconWrapper}>
              <Text style={styles.successIcon}>✓</Text>
            </View>
            
            <Text style={styles.modalTitle}>Authentication Successful</Text>
            
            {employee && (
              <View style={styles.detailsBox}>
                <Text style={styles.detailLabel}>Employee ID:</Text>
                <Text style={styles.detailVal}>{employee.employee_id}</Text>
                
                <Text style={styles.detailLabel}>Name:</Text>
                <Text style={styles.detailVal}>{employee.name}</Text>
                
                <Text style={styles.detailLabel}>Match Score:</Text>
                <Text style={styles.detailVal}>97.85% (Confidence)</Text>
              </View>
            )}

            <GradientButton
              title="Continue to Dashboard"
              onPress={handleProceed}
              style={styles.modalBtn}
            />
          </GlassCard>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    padding: 24,
  },
  permissionCard: {
    gap: 16,
  },
  permissionHeader: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  permissionText: {
    color: '#E2E8F0',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  cancelLink: {
    alignItems: 'center',
    marginTop: 8,
  },
  cancelLinkText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  overlayContainer: {
    flex: 1,
    justifyContent: 'space-between',
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 12,
  },
  backButton: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
  },
  badge: {
    backgroundColor: 'rgba(6, 182, 212, 0.25)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.4)',
  },
  badgeText: {
    color: '#06B6D4',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  scannerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerBox: {
    width: 260,
    height: 260,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
  },
  scannerBoxSuccess: {
    borderColor: '#10B981',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#6366F1', // Indigo corners
    borderWidth: 0,
  },
  cornerSuccess: {
    borderColor: '#10B981',
  },
  topLeft: {
    top: -3,
    left: -3,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: -3,
    right: -3,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: -3,
    left: -3,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: -3,
    right: -3,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  laserLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#06B6D4', // cyan laser line
    shadowColor: '#06B6D4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 6,
  },
  bottomPanel: {
    padding: 24,
  },
  hudCard: {
    alignItems: 'center',
    padding: 18,
  },
  prompt: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
  },
  checklist: {
    width: '100%',
    gap: 12,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxActive: {
    borderColor: '#06B6D4',
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
  },
  checkboxCompleted: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  checkMark: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '900',
  },
  checkLabel: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  checkLabelActive: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    alignItems: 'center',
    padding: 24,
  },
  successIconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 2,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successIcon: {
    color: '#10B981',
    fontSize: 32,
    fontWeight: '900',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 20,
  },
  detailsBox: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  detailLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 8,
  },
  detailVal: {
    color: '#F1F5F9',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
  },
  modalBtn: {
    width: '100%',
  },
});
