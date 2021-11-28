export declare class AutoSwagger {
    path: string;
    private parsedFiles;
    private tagIndex;
    private schemas;
    ui(url: string): string;
    docs(routes: any, options: any): Promise<any>;
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
