/*Copyright (c) 2015-2016 gmail.com All Rights Reserved.
 This software is the confidential and proprietary information of gmail.com You shall not disclose such Confidential Information and shall use it only in accordance
 with the terms of the source code license agreement you entered into with gmail.com*/
package com.mobile_widgets_variables.myjavaservice1.controller;

/*This is a Studio Managed File. DO NOT EDIT THIS FILE. Your changes may be reverted by Studio.*/

import javax.servlet.http.HttpServletRequest;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mobile_widgets_variables.myjavaservice1.MyJavaService1;
import com.wavemaker.tools.api.core.annotations.WMAccessVisibility;
import com.wavemaker.tools.api.core.models.AccessSpecifier;
import com.wordnik.swagger.annotations.Api;

/**
 * Controller object for domain model class {@link MyJavaService1}.
 * @see MyJavaService1
 */
@RestController
@Api(value = "MyJavaService1Controller", description = "controller class for java service execution")
@RequestMapping("/myJavaService1")
public class MyJavaService1Controller {

    @Autowired
    private MyJavaService1 myJavaService1;

    @WMAccessVisibility(value = AccessSpecifier.APP_ONLY)
    @RequestMapping(value = "/sampleJavaOperation", method = RequestMethod.GET)
    public String sampleJavaOperation(@RequestParam(value = "name", required = false) String name,  HttpServletRequest request) {
        return myJavaService1.sampleJavaOperation(name, request);
    }
}