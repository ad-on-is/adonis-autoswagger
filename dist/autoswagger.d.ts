interface options {
    title: string;
    ignore: string[];
    version: string;
    path: string;
    tagIndex: number;
    snakeCase: boolean;
    common: common;
    preferredPutPatch?: string;
}
interface common {
    headers: any;
    parameters: any;
}
export declare class AutoSwagger {
    private parsedFiles;
    private options;
    private schemas;
    private standardTypes;
    ui(url: string): string;
    rapidoc(url: string, style?: string): string;
    writeFile(routes: any, options: any): Promise<void>;
    private readFile;
    docs(routes: any, options: options): Promise<any>;
    generate(routes: any, options: options): Promise<any>;
    private mergeParams;
    private getCustomAnnotations;
    private parseAnnotations;
    private parseParam;
    private parseResponseHeader;
    private parseResponse;
    private jsonToRef;
    private parseRequestBody;
    private getBetweenBrackets;
    private getSchemaExampleBasedOnAnnotation;
    private extractInfos;
    private getSchemas;
    private getModels;
    private getInterfaces;
    private parseInterfaces;
    private parseModelProperties;
    private examples;
    private getFiles;
}
export {};
