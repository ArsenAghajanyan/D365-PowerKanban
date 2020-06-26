import {IInputs, IOutputs} from "./generated/ManifestTypes";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { App } from "../components/App";
import { ParseSearch } from "../domain/ParseSearch";

import { library } from "@fortawesome/fontawesome-svg-core"
import { faTh, faBell, faBellSlash, faEye, faEyeSlash, faWindowClose, faWindowMaximize, faPlus, faPlusSquare, faAngleDoubleRight, faCircle, faSync, faSearch } from "@fortawesome/free-solid-svg-icons"
 
import DataSetInterfaces = ComponentFramework.PropertyHelper.DataSetApi;
type DataSet = ComponentFramework.PropertyTypes.DataSet;

export class PowerKanban implements ComponentFramework.StandardControl<IInputs, IOutputs> {
	private _container: HTMLDivElement;
	private _context: ComponentFramework.Context<IInputs>;
	private _notifyOutputChanged: () => void;

	/**
	 * Empty constructor.
	 */
	constructor()
	{
	}

	/**
	 * Used to initialize the control instance. Controls can kick off remote server calls and other initialization actions here.
	 * Data-set values are not initialized here, use updateView.
	 * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to property names defined in the manifest, as well as utility functions.
	 * @param notifyOutputChanged A callback method to alert the framework that the control has new outputs ready to be retrieved asynchronously.
	 * @param state A piece of data that persists in one session for a single user. Can be set at any point in a controls life cycle by calling 'setControlState' in the Mode interface.
	 * @param container If a control is marked control-type='standard', it will receive an empty div element within which it can render its content.
	 */
	public init(context: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void, state: ComponentFramework.Dictionary, container:HTMLDivElement)
	{
		this._notifyOutputChanged = notifyOutputChanged;
		this._context = context;
		this._container = container;

		library.add(faTh, faBell, faBellSlash, faEye, faEyeSlash, faWindowClose, faWindowMaximize, faPlus, faPlusSquare, faAngleDoubleRight, faCircle, faSync, faSearch);
	}


	/**
	 * Called when any value in the property bag has changed. This includes field values, data-sets, global values such as container height and width, offline status, control metadata values such as label, visible, etc.
	 * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to names defined in the manifest, as well as utility functions
	 */
	public updateView(context: ComponentFramework.Context<IInputs>): void
	{
		const search = ParseSearch();

		ReactDOM.render(
			React.createElement(App, { appId: search["appid"] ?? search["app"] ?? "d365default", configId: this._context.parameters.configId.raw, retrievePrimaryData: (columns: Array<string>) => Promise.resolve([]) }),
			this._container
		);
	}

	/** 
	 * It is called by the framework prior to a control receiving new data. 
	 * @returns an object based on nomenclature defined in manifest, expecting object[s] for property marked as “bound” or “output”
	 */
	public getOutputs(): IOutputs
	{
		return {};
	}

	/** 
	 * Called when the control is to be removed from the DOM tree. Controls should use this call for cleanup.
	 * i.e. cancelling any pending remote calls, removing listeners, etc.
	 */
	public destroy(): void
	{
		ReactDOM.unmountComponentAtNode(this._container);
	}

}