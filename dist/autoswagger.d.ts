export declare class AutoSwagger {
    modelPath: string;
    ui(url: string): string;
    docs(routes: any, options: any): Promise<any>;
    private getCustomAnnotations;
    private getSchemas;
    private parseProperties;
    private getFiles;
    private parseComment;
}
