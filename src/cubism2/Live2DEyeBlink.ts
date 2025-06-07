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
    }

    setEyeParams(value: number) {
        this.eyeParamValue = clamp(value, 0, 1);
        this.coreModel.multParamFloat(this.leftParam, this.eyeParamValue);
        this.coreModel.multParamFloat(this.rightParam, this.eyeParamValue);
    }

    update(dt: DOMHighResTimeStamp) {
        switch (this.eyeState) {
            case EyeState.Idle:
                this.nextBlinkTimeLeft -= dt;

                if (this.nextBlinkTimeLeft < 0) {
                    this.eyeState = EyeState.Closing;
                    this.nextBlinkTimeLeft =
                        this.blinkInterval +
                        this.closingDuration +
                        this.closedDuration +
                        this.openingDuration +
                        rand(0, 2000);
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
                this.eyeParamValue = this.eyeParamValue + dt / this.closingDuration;
                this.setEyeParams(Math.min(this.eyeParamValue, 1));

                if (this.eyeParamValue >= 1) {
                    this.eyeState = EyeState.Idle;
                    this.eyeParamValue = 1;
                }
                break;
        }
    }
}
