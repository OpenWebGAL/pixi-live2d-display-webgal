import { config } from '@/config';
import { Cubism2Spec } from '../types/Cubism2Spec';

export class Live2DExpression extends AMotion {
    readonly params: NonNullable<Cubism2Spec.ExpressionJSON['params']> = [];

    constructor(json: Cubism2Spec.ExpressionJSON) {
        super();

        this.setFadeIn(json.fade_in! > 0 ? json.fade_in! : config.expressionFadingDuration);
        this.setFadeOut(json.fade_out! > 0 ? json.fade_out! : config.expressionFadingDuration);

        if (Array.isArray(json.params)) {
            json.params.forEach(param => {
                const calc = param.calc || 'add';

                if (calc === 'add') {
                    const defaultValue = param.def || 0;
                    param.val -= defaultValue;
                } else if (calc === 'mult') {
                    const defaultValue = param.def || 1;
                    param.val /= defaultValue;
                }

                this.params.push({
                    calc,
                    val: param.val,
                    id: param.id,
                });
            });
        }
    }

    /** @override */
    updateParamExe(model: Live2DModelWebGL, time: number, weight: number, motionQueueEnt: unknown) {
        this.params.forEach(param => {
            switch (param.calc) {
                case "set":
                    model.setParamFloat(param.id, param.val, weight);
                    break;
                case "add":
                    model.addToParamFloat(param.id, param.val * weight);
                    break;
                case "mult":
                    model.multParamFloat(param.id, param.val, weight);
                    break;
            }
        });
    }
}
