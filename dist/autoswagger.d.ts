interface options {
    title: string;
    ignore: string[];
    version: string;
    path: string;
    tagIndex: number;
    common: common;
}
interface common {
    headers: any;
    parameters: any;
}
export declare class AutoSwagger {
    private parsedFiles;
    private options;
    private schemas;
    ui(url: string): string;
    docs(routes: any, options: options): Promise<any>;
    private mergeParams;
    private getCustomAnnotations;
    private parseAnnotations;
    private parseParam;
    private parseResponseHeader;
    private parseResponse;
    private parseRequestBody;
    private getBetweenBrackets;
    private getSchemaExampleBasedOnAnnotation;
    private extractInfos;
    private getSchemas;
    private parseProperties;
    private examples;
    private getFiles;
}
export {};
