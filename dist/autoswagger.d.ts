export declare class AutoSwagger {
    path: string;
    private parsedFiles;
    private tagIndex;
    ui(url: string): string;
    docs(routes: any, options: any): Promise<any>;
    private getCustomAnnotations;
    private parseAnnotations;
    private extractInfos;
    private getModels;
    private parseProperties;
    private getFiles;
}
