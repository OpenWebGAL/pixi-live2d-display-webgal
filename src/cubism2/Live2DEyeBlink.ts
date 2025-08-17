import { clamp, rand } from '@/utils';

const enum EyeState {
    Idle,
    Closing,
    Closed,
    Opening,
}

export class Live2DEyeBlink {
    leftParam: number;
    rightParam: number;

    blinkInterval: DOMHighResTimeStamp = 4000;
    blinkIntervalRandom: DOMHighResTimeStamp = 1000;
    closingDuration: DOMHighResTimeStamp = 100;
    closedDuration: DOMHighResTimeStamp = 50;
    openingDuration: DOMHighResTimeStamp = 150;

    eyeState = EyeState.Idle;
    eyeParamValue = 1;
    closedTimer = 0;
    nextBlinkTimeLeft = this.blinkInterval;

    constructor(readonly coreModel: Live2DModelWebGL) {
        this.leftParam = coreModel.getParamIndex('PARAM_EYE_L_OPEN');
        this.rightParam = coreModel.getParamIndex('PARAM_EYE_R_OPEN');
        this.recalculateBlinkInterval();
    }

    setEyeParams(value: number) {
        this.eyeParamValue = clamp(value, 0, 1);
        this.coreModel.multParamFloat(this.leftParam, this.eyeParamValue);
        this.coreModel.multParamFloat(this.rightParam, this.eyeParamValue);
    }

    /**
     * 计算新的眨眼间隔，包括随机值
     */
    recalculateBlinkInterval() {
        let newBlinkInterval = this.blinkInterval;
        newBlinkInterval += rand(-1, 1) * this.blinkIntervalRandom;
        newBlinkInterval = Math.max(newBlinkInterval, 0);
        this.nextBlinkTimeLeft = newBlinkInterval;
    }

    update(dt: DOMHighResTimeStamp) {
        switch (this.eyeState) {
            case EyeState.Idle:
                this.nextBlinkTimeLeft -= dt;

                if (this.nextBlinkTimeLeft < 0) {
                    this.eyeState = EyeState.Closing;
                    this.recalculateBlinkInterval();
                }
                break;

            case EyeState.Closing:
                this.eyeParamValue = this.eyeParamValue - dt / this.closingDuration;
                this.setEyeParams(Math.max(this.eyeParamValue, 0));

                if (this.eyeParamValue <= 0) {
                    this.eyeState = EyeState.Closed;
                    this.closedTimer = 0;
                    this.eyeParamValue = 0;
                }
                break;

            case EyeState.Closed:
                this.closedTimer += dt;
                this.setEyeParams(this.eyeParamValue);

                if (this.closedTimer >= this.closedDuration) {
                    this.eyeState = EyeState.Opening;
                }
                break;

            case EyeState.Opening:
                this.eyeParamValue = this.eyeParamValue + dt / this.openingDuration;
                this.setEyeParams(Math.min(this.eyeParamValue, 1));

                if (this.eyeParamValue >= 1) {
                    this.eyeState = EyeState.Idle;
                    this.eyeParamValue = 1;
                }
                break;
        }
    }
}
