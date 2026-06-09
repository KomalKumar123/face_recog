/**
 * LivenessEngine.ts
 *
 * Implements active liveness detection algorithms completely on-device.
 * Evaluates facial landmarks to calculate:
 * - Eye Aspect Ratio (EAR) for blink verification.
 * - Mouth Aspect Ratio (MAR) for smile verification.
 * - Facial symmetry coordinates mapping for Turn Left verification.
 */

export interface Landmark {
  x: number;
  y: number;
}

export interface LivenessProgress {
  blinkPassed: boolean;
  smilePassed: boolean;
  turnLeftPassed: boolean;
  currentPrompt: 'BLINK' | 'SMILE' | 'TURN_LEFT' | 'COMPLETED';
}

export class LivenessEngine {
  private static readonly EAR_THRESHOLD = 0.22;
  private static readonly EAR_RECOVERY_THRESHOLD = 0.29;
  private static readonly MAR_THRESHOLD = 3.6;
  private static readonly YAW_ASYMMETRY_LEFT_THRESHOLD = 1.95;

  private isEyeClosed = false;

  /**
   * Calculates the Eye Aspect Ratio (EAR).
   */
  public static calculateEAR(eye: Landmark[]): number {
    if (eye.length < 6) return 1.0;
    const d2_6 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
    const d3_5 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
    const d1_4 = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
    return (d2_6 + d3_5) / (2.0 * d1_4);
  }

  /**
   * Calculates the Mouth Aspect Ratio (MAR).
   */
  public static calculateMAR(mouth: Landmark[]): number {
    if (mouth.length < 12) return 2.0;
    const width = Math.hypot(mouth[0].x - mouth[6].x, mouth[0].y - mouth[6].y);
    const height = Math.hypot(mouth[3].x - mouth[9].x, mouth[3].y - mouth[9].y);
    return height > 0 ? width / height : 0;
  }

  /**
   * Estimates head yaw rotation based on nose tip translation relative to cheek boundaries.
   */
  public static calculateNoseSymmetry(noseTip: Landmark, jawLeft: Landmark, jawRight: Landmark): number {
    const distLeft = Math.hypot(noseTip.x - jawLeft.x, noseTip.y - jawLeft.y);
    const distRight = Math.hypot(noseTip.x - jawRight.x, noseTip.y - jawRight.y);
    return distRight > 0 ? distLeft / distRight : 1.0;
  }

  /**
   * Evaluates landmark coordinates against the current active challenge step.
   */
  public evaluateFrame(
    landmarks: {
      leftEye: Landmark[];
      rightEye: Landmark[];
      mouth: Landmark[];
      noseTip: Landmark;
      jawLeft: Landmark;
      jawRight: Landmark;
    },
    currentState: LivenessProgress
  ): LivenessProgress {
    const nextState = { ...currentState };

    if (currentState.currentPrompt === 'BLINK') {
      const earL = LivenessEngine.calculateEAR(landmarks.leftEye);
      const earR = LivenessEngine.calculateEAR(landmarks.rightEye);
      const avgEAR = (earL + earR) / 2;

      if (avgEAR < LivenessEngine.EAR_THRESHOLD) {
        this.isEyeClosed = true;
      } else if (avgEAR > LivenessEngine.EAR_RECOVERY_THRESHOLD && this.isEyeClosed) {
        nextState.blinkPassed = true;
        nextState.currentPrompt = 'SMILE';
        this.isEyeClosed = false;
        console.log('[LivenessEngine] Blink challenge passed.');
      }
    } 
    else if (currentState.currentPrompt === 'SMILE') {
      const mar = LivenessEngine.calculateMAR(landmarks.mouth);
      if (mar > LivenessEngine.MAR_THRESHOLD) {
        nextState.smilePassed = true;
        nextState.currentPrompt = 'TURN_LEFT';
        console.log('[LivenessEngine] Smile challenge passed.');
      }
    } 
    else if (currentState.currentPrompt === 'TURN_LEFT') {
      const symmetry = LivenessEngine.calculateNoseSymmetry(
        landmarks.noseTip,
        landmarks.jawLeft,
        landmarks.jawRight
      );

      if (symmetry > LivenessEngine.YAW_ASYMMETRY_LEFT_THRESHOLD || symmetry < 0.52) {
        nextState.turnLeftPassed = true;
        nextState.currentPrompt = 'COMPLETED';
        console.log('[LivenessEngine] Turn Left challenge passed.');
      }
    }

    return nextState;
  }
}
