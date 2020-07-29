import { FlyOutForm } from "./FlyOutForm";

export interface CustomButton {
    id: string;
    icon: { type: string; value: string; };
    label: string;
    callBack: string;
}

export interface BoardEntity {
    logicalName: string;
    swimLaneSource: string;
    transitionCallback: string;
    notificationLookup: string;
    subscriptionLookup: string;
    allowTransitions: boolean;
    customButtons: Array<CustomButton>;
}

export interface SecondaryEntity extends BoardEntity {
    parentLookup: string;
}

export interface Context {
    showForm: (form: FlyOutForm) => Promise<any>;
}

export interface PrimaryEntity extends BoardEntity {

}

export interface BoardViewConfig {
    defaultViewId: string;
    notificationCardFormId: string;
    primaryEntity: PrimaryEntity;
    secondaryEntity: SecondaryEntity;
    customScriptUrl: string;
}