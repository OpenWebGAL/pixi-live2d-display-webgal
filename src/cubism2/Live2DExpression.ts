import { EXPRESSION_FADING_DURATION } from '@/cubism-common/constants';
import ExpressionJSON = Cubism2Spec.ExpressionJSON;

export class Live2DExpression extends AMotion {
    readonly params: NonNullable<ExpressionJSON['params']> = [];

    constructor(json: ExpressionJSON) {
        super();

        this.setFadeIn(json.fade_in! > 0 ? json.fade_in! : EXPRESSION_FADING_DURATION);
        this.setFadeOut(json.fade_out! > 0 ? json.fade_out! : EXPRESSION_FADING_DURATION);

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
    updateParamExe(model: Live2DModelWebGL, time: DOMTimeStamp, weight: number, motionQueueEnt: unknown) {
        this.params.forEach(param => {
            // this algorithm seems to be broken for newer Neptunia series models, have no idea
            //
            // switch (param.type) {
            //     case ParamCalcType.Set:
            //         model.setParamFloat(param.id, param.value, weight);
            //         break;
            //     case ParamCalcType.Add:
            //         model.addToParamFloat(param.id, param.value * weight);
            //         break;
            //     case ParamCalcType.Mult:
            //         model.multParamFloat(param.id, param.value, weight);
            //         break;
            // }

            // this works fine for any model
            model.setParamFloat(param.id, param.val * weight);
        });
    }
}