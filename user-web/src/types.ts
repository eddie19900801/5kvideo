export type VideoSummary={id:string;title:string;thumbnail:string;duration:number;views:number;tags:string[];category:string;updatedAt:string;aspectRatio:"landscape"|"portrait"};
export type Highlight={id:string;time:number;image:string};
export type VideoDetail=VideoSummary&{description:string;playbackUrl:string;trimStart:number;trimEnd:number;highlights:Highlight[]};
export type VideoPage={page:number;pageSize:number;total:number;pageCount:number;items:VideoSummary[]};
export type Category={id:string;name:string;count:number};
