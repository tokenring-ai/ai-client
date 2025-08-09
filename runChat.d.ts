export function execute({ input, systemPrompt, model }: {
    input: any;
    systemPrompt: any;
    model: any;
}, registry: any): Promise<any[]>;
export default execute;
export const description: "Runs a chat with the AI model, combining streamChat and runChat functionality.";
export namespace parameters {
    let type: string;
    namespace properties {
        namespace input {
            let type_1: string;
            export { type_1 as type };
            export let description: string;
        }
        namespace systemPrompt {
            let type_2: string;
            export { type_2 as type };
            let description_1: string;
            export { description_1 as description };
        }
        namespace model {
            let type_3: string;
            export { type_3 as type };
            let description_2: string;
            export { description_2 as description };
        }
    }
    let required: string[];
    let additionalProperties: boolean;
}
