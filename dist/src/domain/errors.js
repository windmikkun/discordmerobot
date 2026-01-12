export class ValidationError extends Error {
    constructor(field, message) {
        super(message);
        this.field = field;
        this.name = 'ValidationError';
    }
}
export class SelfSendNotAllowedError extends Error {
    constructor() {
        super('自分自身にポイントを付与することはできません');
        this.name = 'SelfSendNotAllowedError';
    }
}
export class BotTargetNotAllowedError extends Error {
    constructor() {
        super('Botにポイントを付与することはできません');
        this.name = 'BotTargetNotAllowedError';
    }
}
export class PointTypeNotFoundError extends Error {
    constructor(typeKey) {
        super(`ポイント種 "${typeKey}" は存在しません`);
        this.name = 'PointTypeNotFoundError';
    }
}
export class PointTypeDisabledError extends Error {
    constructor(typeKey) {
        super(`ポイント種 "${typeKey}" は現在無効です`);
        this.name = 'PointTypeDisabledError';
    }
}
export class DailyLimitExceededError extends Error {
    constructor(limit, current) {
        super(`日次送信回数制限を超過しました (${current}/${limit})`);
        this.limit = limit;
        this.current = current;
        this.name = 'DailyLimitExceededError';
    }
}
