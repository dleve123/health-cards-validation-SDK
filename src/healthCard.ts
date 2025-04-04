// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as utils from './utils';
import { validateSchema } from './schema';
import { ErrorCode } from './error';
import healthCardSchema from '../schema/smart-health-card-schema.json';
import * as jws from './jws-compact';
import Log from './logger';
import { ValidationResult } from './validate';


export const schema = healthCardSchema;


export async function validate(healthCardText: string): Promise<ValidationResult> {

    const log = new Log('SMART Health Card');

    if (healthCardText.trim() !== healthCardText) {
        log.warn(`Health Card has leading or trailing spaces`, ErrorCode.TRAILING_CHARACTERS);
        healthCardText = healthCardText.trim();
    }

    const healthCard = utils.parseJson<HealthCard>(healthCardText);
    if (healthCard == undefined) {
        return {
            result: healthCard,
            log: log.fatal("Failed to parse HealthCard data as JSON.", ErrorCode.JSON_PARSE_ERROR)
        }
    }

    // failures will be recorded in the log. we can continue processing.
    validateSchema(healthCardSchema, healthCard, log);


    // to continue validation, we must have a jws-compact string to validate
    const vc = healthCard.verifiableCredential;
    if (
        !vc ||
        !(vc instanceof Array) ||
        vc.length === 0 ||
        typeof vc[0] !== 'string'
    ) {
        // The schema check above will list the expected properties/type
        return {
            result: healthCard,
            log: log.fatal("HealthCard.verifiableCredential[jws-compact] required to continue.", ErrorCode.CRITICAL_DATA_MISSING)
        }
    }


    for (let i = 0; i < vc.length; i++) {
        log.child.push((await jws.validate(vc[i], vc.length> 1 ? i.toString() : '')).log)
    }

    return { result: healthCard, log: log };
}
