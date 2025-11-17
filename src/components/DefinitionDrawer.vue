<script setup lang="ts">
import { ref, watch, computed } from "vue";

import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
    DrawerFooter,
    DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { fetch } from "@tauri-apps/plugin-http";

import { useScreenOrientation } from "@vueuse/core";

const props = defineProps<{
    word: string | null;
}>();

const isOpen = defineModel<boolean>("open");

const definition = ref<any>(null);
const isLoading = ref(false);
const error = ref<string | null>(null);
const aiFallbackAvailable = ref(false);
const wordToDefine = ref("");

async function fetchDefinition(word: string) {
    if (!word) return;
    isLoading.value = true;
    error.value = null;
    definition.value = null;
    aiFallbackAvailable.value = false;
    wordToDefine.value = word.trim().split(" ")[0];

    try {
        const response = await fetch(
            `https://api.dictionaryapi.dev/api/v2/entries/en/${wordToDefine.value}`,
            {
                method: "GET",
            },
        );
        console.log(response);
        if (response.ok) {
            let x = await response.json();
            console.log(x[0]);
            definition.value = (x as any[])[0];
        } else {
            aiFallbackAvailable.value = true;
            error.value = `No definition found for "${wordToDefine.value}".`;
        }
    } catch (e) {
        aiFallbackAvailable.value = true;
        error.value = `Could not connect to dictionary service: ${e}`;
    } finally {
        isLoading.value = false;
    }
}

async function fetchAIDefinition() {
    isLoading.value = true;
    error.value = null;
    aiFallbackAvailable.value = false;

    const CLOUDFLARE_ACCOUNT_ID = "fa9d3da9946a9965af134783d6fecae1";
    const CLOUDFLARE_API_KEY = "mIXSGQ-ebIJj1JorTWc4PFfGRgIzQIC-ouu4zgqF";
    const model = "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b";

    try {
        const schema = {
            type: "array",
            items: {
                type: "object",
                properties: {
                    word: { type: "string" },
                    phonetic: { type: "string" },
                    phonetics: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                text: { type: "string" },
                                audio: { type: "string" },
                            },
                            required: ["text"],
                        },
                    },
                    origin: { type: "string" },
                    meanings: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                partOfSpeech: { type: "string" },
                                definitions: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            definition: { type: "string" },
                                            example: { type: "string" },
                                            synonyms: {
                                                type: "array",
                                                items: { type: "string" },
                                            },
                                            antonyms: {
                                                type: "array",
                                                items: { type: "string" },
                                            },
                                        },
                                        required: [
                                            "definition",
                                            "synonyms",
                                            "antonyms",
                                        ],
                                    },
                                },
                            },
                            required: ["partOfSpeech", "definitions"],
                        },
                    },
                },
                required: ["word", "phonetic", "phonetics", "meanings"],
            },
        };

        const body = {
            messages: [
                {
                    role: "system",
                    content:
                        "You are a dictionary assistant. Define the word following the provided JSON schema strictly. If the word is not part of conventional language, define it in the context/world of any books if appears in.",
                },
                {
                    role: "user",
                    content: `Define the word: "${wordToDefine.value}"`,
                },
            ],
            response_format: {
                type: "json_schema",
                json_schema: schema,
            },
        };

        const finalUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`;

        const response = await fetch(finalUrl, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${CLOUDFLARE_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        console.log("sent 1");

        if (!response.ok) {
            throw new Error(
                `Cloudflare AI API request failed: ${response.status}`,
            );
        }
        console.log(response);

        const json = await response.json();

        console.log("sent 2");
        if (!json.result) {
            throw new Error("Invalid AI response format");
        }

        console.log("sent 3");
        if (!json.success) {
            throw new Error(json.errors[0]);
        }

        console.log(json.result);
        definition.value = json.result.response;
    } catch (err: any) {
        error.value = `AI definition failed: ${err.message}`;
    } finally {
        isLoading.value = false;
    }
}

watch(isOpen, (val) => {
    if (val && props.word) {
        fetchDefinition(props.word);
    }
});

watch(
    () => props.word,
    (newWord) => {
        if (isOpen.value && newWord) {
            fetchDefinition(newWord);
        }
    },
);

const { orientation } = useScreenOrientation();
const isVertical = computed(
    () =>
        orientation.value == "portrait-primary" ||
        orientation.value == "portrait-secondary",
);
</script>

<template>
    <Drawer v-model:open="isOpen">
        <DrawerContent
            :class="{
                'max-w-calc(50vw_-_20px) ml-[50vw]': !isVertical,
            }"
        >
            <div class="mx-auto w-full max-w-2xl">
                <DrawerHeader>
                    <DrawerTitle>Definition for "{{ props.word }}"</DrawerTitle>
                    <DrawerDescription v-if="isLoading"
                        >Loading...</DrawerDescription
                    >
                    <DrawerDescription v-if="error" class="text-red-500">{{
                        error
                    }}</DrawerDescription>
                </DrawerHeader>
                <div v-if="aiFallbackAvailable" class="p-4 text-center">
                    <Button @click="fetchAIDefinition"
                        >Try AI-Generated Definition</Button
                    >
                </div>
                <div
                    class="p-4 pb-0 max-h-[60vh] overflow-y-auto"
                    v-if="definition"
                >
                    <div
                        v-for="(meaning, index) in definition.meanings"
                        :key="index"
                        class="mb-4"
                    >
                        <h3 class="font-bold text-lg capitalize">
                            {{ meaning.partOfSpeech }}
                        </h3>
                        <ul class="list-disc pl-5 mt-2 space-y-2">
                            <li
                                v-for="(def, i) in meaning.definitions"
                                :key="i"
                            >
                                <p>{{ def.definition }}</p>
                                <p
                                    v-if="def.example"
                                    class="text-gray-500 italic mt-1"
                                >
                                    "{{ def.example }}"
                                </p>
                            </li>
                        </ul>
                    </div>
                </div>
                <DrawerFooter>
                    <DrawerClose as-child>
                        <Button variant="outline"> Close </Button>
                    </DrawerClose>
                </DrawerFooter>
            </div>
        </DrawerContent>
    </Drawer>
</template>
