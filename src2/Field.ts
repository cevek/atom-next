export interface Field {
    name: string;
    idx: number;
    Class: (new () => {}) | undefined;
    elementFactory: (new () => {}) | undefined;
}
