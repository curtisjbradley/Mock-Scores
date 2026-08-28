export const REQUEST_TYPES = ["Bug Report", "Feature Request", "Feedback"];

export type RequestType = typeof REQUEST_TYPES[number];

export interface IHelpParams{
    requestType: RequestType;
    description: string;
}