import * as React from "react";
import { useAppContext, useAppDispatch, AppStateProps, AppStateDispatch } from "../domain/AppState";
import { Card, Table, Row, Col, DropdownButton, Dropdown, Button, ButtonGroup, Image, Badge } from "react-bootstrap";
import { FieldRow } from "./FieldRow";
import { Metadata, Option, Attribute } from "../domain/Metadata";
import { CardForm } from "../domain/CardForm";
import { BoardLane } from "../domain/BoardLane";
import { Lane } from "./Lane";
import { ItemTypes } from "../domain/ItemTypes";
import { refresh, fetchSubscriptions, fetchNotifications } from "../domain/fetchData";
import * as WebApiClient from "xrm-webapi-client";
import { useDrag, DragSourceMonitor } from "react-dnd";
import { FlyOutForm } from "../domain/FlyOutForm";
import { Notification } from "../domain/Notification";
import { BoardViewConfig, PrimaryEntity, BoardEntity } from "../domain/BoardViewConfig";
import { Subscription } from "../domain/Subscription";
import { useConfigState } from "../domain/ConfigState";
import { useActionContext, DisplayType, useActionDispatch } from "../domain/ActionState";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

interface TileProps {
    borderColor: string;
    cardForm: CardForm;
    config: BoardEntity;
    data: any;
    dndType?: string;
    laneOption?: Option;
    metadata: Metadata;
    notifications: Array<Notification>;
    searchText: string;
    secondaryData?: Array<BoardLane>;
    secondaryNotifications?: {[key: string]: Array<Notification>};
    secondarySubscriptions?: {[key: string]: Array<Subscription>};
    selectedSecondaryForm?: CardForm;
    separatorMetadata: Attribute;
    style?: React.CSSProperties;
    subscriptions: Array<Subscription>;
    refresh: () => Promise<void>;
    preventDrag?: boolean;
}

const TileRender = (props: TileProps) => {
    const appDispatch = useAppDispatch();
    const configState = useConfigState();
    const actionDispatch = useActionDispatch();

    const secondaryConfig = configState.config.secondaryEntity;
    const secondaryMetadata = configState.secondaryMetadata[secondaryConfig ? secondaryConfig.logicalName : ""];
    const secondarySeparator = configState.secondarySeparatorMetadata;
    const stub = React.useRef(undefined);

    const context = {
        showForm: (form: FlyOutForm) => {
            return new Promise((resolve, reject) => {
                form.resolve = resolve;
                form.reject = reject;

                actionDispatch({ type: "setFlyOutForm", payload: form });
            });
        },
        refresh: props.refresh,
        setWorkIndicator: (working: boolean) => {
            return actionDispatch({ type: "setWorkIndicator", payload: working });
        },
        data: props.data,
        WebApiClient: WebApiClient
    };

    const accessFunc = (identifier: string) => {
        const path = identifier.split(".");
        return path.reduce((all, cur) => !all ? undefined : (all as any)[cur], window);
    };

    const [{ isDragging }, drag] = useDrag<{ id: string; sourceLane: Option, type: string } | undefined, undefined, {isDragging: boolean}>({
        item: { id: props.data[props.metadata.PrimaryIdAttribute], sourceLane: props.laneOption, type: props.dndType ?? ItemTypes.Tile } as any,
        end: (item: { id: string; sourceLane: Option } | undefined, monitor: DragSourceMonitor) => {
            const asyncEnd = async (item: { id: string; sourceLane: Option } | undefined, monitor: DragSourceMonitor) => {
                const dropResult = monitor.getDropResult();

                if (!dropResult || dropResult?.option?.Value == null || dropResult.option.Value === item.sourceLane.Value) {
                    return;
                }

                let preventDefault = false;

                if (props.config.transitionCallback) {
                    const eventContext = {
                        ...context,
                        target: dropResult.option
                    };

                    const funcRef = accessFunc(props.config.transitionCallback) as any;

                    const result = await Promise.resolve(funcRef(eventContext));
                    preventDefault = result?.preventDefault;
                }

                if (preventDefault) {
                    actionDispatch({ type: "setWorkIndicator", payload: false });
                }
                else {
                    actionDispatch({ type: "setWorkIndicator", payload: true });
                    const itemId = item.id;
                    const targetOption = dropResult.option as Option;
                    const update: any = { [props.separatorMetadata.LogicalName]: targetOption.Value };

                    if (props.separatorMetadata.LogicalName === "statuscode") {
                        update["statecode"] = targetOption.State;
                    }

                    await WebApiClient.Update({ entityName: props.metadata.LogicalName, entityId: itemId, entity: update })
                    .then((r: any) => {
                        actionDispatch({ type: "setWorkIndicator", payload: false });
                        return props.refresh();
                    })
                    .catch((e: any) => {
                        actionDispatch({ type: "setWorkIndicator", payload: false });
                    });
                }
            };

            asyncEnd(item, monitor);
        },
        collect: (monitor) => ({
          isDragging: monitor.isDragging()
        })
    });

    const opacity = isDragging ? 0.4 : 1;

    const setSelectedRecord = () => {
        actionDispatch({ type: "setSelectedRecordDisplayType", payload: DisplayType.recordForm });
        actionDispatch({ type: "setSelectedRecord", payload: { entityType: props.metadata.LogicalName, id: props.data[props.metadata?.PrimaryIdAttribute] } });
    };

    const showNotifications = () => {
        actionDispatch({ type: "setSelectedRecordDisplayType", payload: DisplayType.notifications });
        actionDispatch({ type: "setSelectedRecord", payload: { entityType: props.metadata.LogicalName, id: props.data[props.metadata?.PrimaryIdAttribute] } });
    };

    const openInNewTab = () => {
        Xrm.Navigation.openForm({ entityName: props.metadata.LogicalName, entityId: props.data[props.metadata?.PrimaryIdAttribute], openInNewWindow: true });
    };

    const openInModal = () => {
        const input : Xrm.Navigation.PageInputEntityRecord = {
			pageType: "entityrecord",
            entityName: props.metadata.LogicalName,
            entityId: props.data[props.metadata?.PrimaryIdAttribute]
        }

        const options : Xrm.Navigation.NavigationOptions = {
			target: 2,
			width: {
                value: 70,
                unit: "%"
            },
			position: 1
		};

        Xrm.Navigation.navigateTo(input, options);
    };

    const createNewSecondary = async () => {
        const parentLookup = configState.config.secondaryEntity.parentLookup;
        const data = {
            [parentLookup]: props.data[props.metadata.PrimaryIdAttribute],
            [`${parentLookup}type`]: props.metadata.LogicalName,
            [`${parentLookup}name`]: props.data[props.metadata.PrimaryNameAttribute]
        };

        const result = await Xrm.Navigation.openForm({ entityName: secondaryMetadata.LogicalName, useQuickCreateForm: true }, data);

        if (result && result.savedEntityReference) {
            props.refresh();
        }
    };

    const subscribe = async () => {
        actionDispatch({ type: "setWorkIndicator", payload: true });

        await WebApiClient.Create({
            entityName: "oss_subscription",
            entity: {
                [`${props.config.subscriptionLookup}@odata.bind`]: `/${props.metadata.LogicalCollectionName}(${props.data[props.metadata.PrimaryIdAttribute].replace("{", "").replace("}", "")})`
            }
        });

        const subscriptions = await fetchSubscriptions(configState.config);
        appDispatch({ type: "setSubscriptions", payload: subscriptions });
        actionDispatch({ type: "setWorkIndicator", payload: false });
    };

    const unsubscribe = async () => {
        actionDispatch({ type: "setWorkIndicator", payload: true });
        const subscriptionsToDelete = props.subscriptions.filter(s => s[`_${props.config.subscriptionLookup}_value`] === props.data[props.metadata.PrimaryIdAttribute]);

        await Promise.all(subscriptionsToDelete.map(s =>
            WebApiClient.Delete({
                entityName: "oss_subscription",
                entityId: s.oss_subscriptionid
            })
        ));

        const subscriptions = await fetchSubscriptions(configState.config);
        appDispatch({ type: "setSubscriptions", payload: subscriptions });
        actionDispatch({ type: "setWorkIndicator", payload: false });
    };

    const clearNotifications = async () => {
        actionDispatch({ type: "setWorkIndicator", payload: true });
        const notificationsToDelete = props.notifications;

        await Promise.all(notificationsToDelete.map(s =>
            WebApiClient.Delete({
                entityName: "oss_notification",
                entityId: s.oss_notificationid
            })
        ));

        const notifications = await fetchNotifications(configState.config);
        appDispatch({ type: "setNotifications", payload: notifications });
        actionDispatch({ type: "setWorkIndicator", payload: false });
    };

    const initCallBack = (identifier: string) => {
        return async () => {
            const funcRef = accessFunc(identifier) as any;
            return Promise.resolve(funcRef(context));
        };
    };

    const isSubscribed = props.subscriptions && props.subscriptions.length;

    console.log(`${props.metadata.LogicalName} tile ${props.data[props.metadata.PrimaryIdAttribute]} is rerendering`);

    return (
        <div ref={ props.preventDrag ? stub : drag}>
            <Card onDoubleClick={openInModal} style={{opacity, marginBottom: "5px", borderColor: "#d8d8d8", borderLeftColor: props.borderColor, borderLeftWidth: "3px", ...props.style}}>
                <Card.Header style={{ padding: "10px" }}>
                    <div style={{display: "flex", flexDirection: "row"}}>
                        <div style={{display: "flex", flex: "1", overflow: "auto", flexDirection: "column", color: "#666666" }}>
                            { props.cardForm.parsed.header.rows.map((r, i) => <div key={`headerRow_${props.data[props.metadata.PrimaryIdAttribute]}_${i}`} style={{ flex: "1" }}><FieldRow searchString={props.searchText} type="header" metadata={props.metadata} data={props.data} cells={r.cells} /></div>) }
                        </div>
                        { props.config.notificationLookup && props.config.subscriptionLookup && <Dropdown as={ButtonGroup} style={{ display: "initial", margintop: "5px", marginRight: "5px" }}>
                            <Button onClick={showNotifications} variant="outline-secondary">
                                {
                                <span>{isSubscribed ? <FontAwesomeIcon icon="bell" /> : <FontAwesomeIcon icon="bell-slash" /> } { props.notifications?.length > 0 && <Badge variant="danger">{props.notifications.length}</Badge> }</span>
                                }
                            </Button>
                            <Dropdown.Toggle split variant="outline-secondary" id="dropdown-split-basic" />
                            <Dropdown.Menu>
                                <Dropdown.Item as="button" onClick={subscribe}><FontAwesomeIcon icon="bell" /> Subscribe</Dropdown.Item>
                                <Dropdown.Item as="button" onClick={unsubscribe}><FontAwesomeIcon icon="bell-slash" /> Unsubscribe</Dropdown.Item>
                                <Dropdown.Item as="button" onClick={clearNotifications}><FontAwesomeIcon icon="eye-slash" /> Mark as read</Dropdown.Item>
                                <Dropdown.Item as="button" onClick={showNotifications}><FontAwesomeIcon icon="eye" /> Show notifications</Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown>}
                        <DropdownButton id="displaySelector" variant="outline-secondary" title="" style={{ margintop: "5px" }}>
                            <Dropdown.Item onClick={setSelectedRecord} as="button" id="setSelected"><FontAwesomeIcon icon="angle-double-right" /> Open in split screen</Dropdown.Item>
                            <Dropdown.Item onClick={openInNewTab} as="button" id="setSelected"><FontAwesomeIcon icon="external-link-alt" /> Open in new window</Dropdown.Item>
                            <Dropdown.Item onClick={openInModal} as="button" id="openModal"><FontAwesomeIcon icon="window-maximize" /> Open in modal</Dropdown.Item>
                            { secondaryConfig && <Dropdown.Item onClick={createNewSecondary} as="button" id="addSecondary"><FontAwesomeIcon icon="plus" /> Create new {secondaryMetadata.DisplayName.UserLocalizedLabel.Label}</Dropdown.Item> }
                            {
                                props.config.customButtons && props.config.customButtons.length &&
                                <>
                                    <Dropdown.Divider></Dropdown.Divider>
                                    { props.config.customButtons.map(b => <Dropdown.Item key={b.id} id={b.id} as="button" onClick={initCallBack(b.callBack)}>
                                        <>
                                            {b.icon && b.icon.type === "url" && <img src={b.icon.value}></img>}
                                            {" "}{b.label}
                                        </>
                                    </Dropdown.Item>) }
                                </>
                            }
                        </DropdownButton>
                    </div>
                </Card.Header>
                <Card.Body style={{ padding: "10px" }}>
                    <div style={{display: "flex", overflow: "auto", flexDirection: "column" }}>
                        { props.cardForm.parsed.body.rows.map((r, i) => <div key={`bodyRow_${props.data[props.metadata.PrimaryIdAttribute]}_${i}`} style={{ minWidth: "200px", margin: "5px", flex: "1" }}><FieldRow searchString={props.searchText} type="body" metadata={props.metadata} data={props.data} cells={r.cells} /></div>) }
                    </div>
                    { props.secondaryData &&
                    <div>
                        <div className="border-top my-3"></div>
                        <span style={{marginLeft: "5px", fontSize: "larger"}}>
                            {secondaryMetadata.DisplayCollectionName.UserLocalizedLabel.Label}
                        </span>
                        <Button style={{marginLeft: "5px"}} variant="outline-secondary" onClick={createNewSecondary}><FontAwesomeIcon icon="plus-square" /></Button>
                        <div id="flexContainer" style={{ display: "flex", flexDirection: "row", overflow: "auto" }}>
                            {
                                props.secondaryData.map(d => <Lane
                                refresh={props.refresh}
                                notifications={props.secondaryNotifications}
                                searchText={props.searchText}
                                subscriptions={props.secondarySubscriptions}
                                dndType={`${ItemTypes.Tile}_${props.data[props.metadata.PrimaryIdAttribute]}`}
                                key={`lane_${d.option?.Value ?? "fallback"}`}
                                minWidth="300px"
                                cardForm={props.selectedSecondaryForm}
                                metadata={secondaryMetadata}
                                lane={d}
                                config={secondaryConfig}
                                separatorMetadata={secondarySeparator}
                                isSecondaryLane />)
                            }
                        </div>
                    </div>
                    }
                </Card.Body>
                <Card.Footer style={{ backgroundColor: "#efefef", padding: "10px" }}>
                    <div style={{display: "flex", overflow: "auto", flexDirection: "column" }}>
                        { props.cardForm.parsed.footer.rows.map((r, i) => <div key={`footerRow_${props.data[props.metadata.PrimaryIdAttribute]}_${i}`} style={{ minWidth: "200px", margin: "5px", flex: "1" }}><FieldRow searchString={props.searchText} type="footer" metadata={props.metadata} data={props.data} cells={r.cells} /></div>) }
                    </div>
                </Card.Footer>
            </Card>
        </div>
    );
};

const isDataEqual = (a: any, b: any) => {
    if (Object.keys(a).length != Object.keys(b).length) {
        return false;
    }

    if (Object.keys(a).some(k => {
        const value = a[k];
        return b[k] !== value;
    })) {
        return false;
    }

    return true;
}

export const Tile = React.memo(TileRender, (a, b) => {
    if (a.borderColor != b.borderColor) {
        return false;
    }

    if (a.cardForm != b.cardForm) {
        return false;
    }

    if (a.dndType != b.dndType) {
        return false;
    }

    if (a.laneOption != b.laneOption) {
        return false;
    }

    if (a.metadata != b.metadata) {
        return false;
    }

    if (a.searchText != b.searchText) {
        return false;
    }

    if (a.style != b.style) {
        return false;
    }

    if ((a.notifications || []).length != (b.notifications || []).length) {
        return false;
    }

    if ((a.subscriptions || []).length != (b.subscriptions || []).length) {
        return false;
    }

    const secondaryNotificationsA = Object.keys(a.secondaryNotifications || {}).reduce((all, cur) => [...all, ...a.secondaryNotifications[cur]], []);
    const secondaryNotificationsB = Object.keys(b.secondaryNotifications || {}).reduce((all, cur) => [...all, ...b.secondaryNotifications[cur]], []);

    if (secondaryNotificationsA.length != secondaryNotificationsB.length) {
        return false;
    }

    const secondarySubscriptionsA = Object.keys(a.secondarySubscriptions || {}).reduce((all, cur) => [...all, ...a.secondarySubscriptions[cur]], []);
    const secondarySubscriptionsB = Object.keys(b.secondarySubscriptions || {}).reduce((all, cur) => [...all, ...b.secondarySubscriptions[cur]], []);

    if (secondarySubscriptionsA.length != secondarySubscriptionsB.length) {
        return false;
    }

    const secondaryDataA = a.secondaryData || [];
    const secondaryDataB = b.secondaryData || [];

    if (secondaryDataA.length != secondaryDataB.length || secondaryDataA.some((a, i) => a.data.length != secondaryDataB[i].data.length || a.data.some((d, j) => !isDataEqual(d, secondaryDataB[i].data[j])))) {
        return false;
    }

    return isDataEqual(a.data, b.data);
});