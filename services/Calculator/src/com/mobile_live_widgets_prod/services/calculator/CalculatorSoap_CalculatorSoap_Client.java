/*Copyright (c) 2015-2016 gmail.com All Rights Reserved.
 This software is the confidential and proprietary information of gmail.com You shall not disclose such Confidential Information and shall use it only in accordance
 with the terms of the source code license agreement you entered into with gmail.com*/

package com.mobile_live_widgets_prod.services.calculator;

/**
 * Please modify this class to meet your needs
 * This class is not complete
 */

import java.io.File;
import java.net.MalformedURLException;
import java.net.URL;
import javax.xml.namespace.QName;
import javax.jws.WebMethod;
import javax.jws.WebParam;
import javax.jws.WebResult;
import javax.jws.WebService;
import javax.jws.soap.SOAPBinding;
import javax.xml.bind.annotation.XmlSeeAlso;

/**
 * This class was generated by Apache CXF 2.7.11
 * 2017-04-10T07:31:51.273Z
 * Generated source version: 2.7.11
 * 
 */
public final class CalculatorSoap_CalculatorSoap_Client {

    private static final QName SERVICE_NAME = new QName("http://tempuri.org/", "Calculator");

    private CalculatorSoap_CalculatorSoap_Client() {
    }

    public static void main(String args[]) throws java.lang.Exception {
        URL wsdlURL = Calculator.WSDL_LOCATION;
        if (args.length > 0 && args[0] != null && !"".equals(args[0])) { 
            File wsdlFile = new File(args[0]);
            try {
                if (wsdlFile.exists()) {
                    wsdlURL = wsdlFile.toURI().toURL();
                } else {
                    wsdlURL = new URL(args[0]);
                }
            } catch (MalformedURLException e) {
                e.printStackTrace();
            }
        }
      
        Calculator ss = new Calculator(wsdlURL, SERVICE_NAME);
        CalculatorSoap port = ss.getCalculatorSoap();  
        
        {
        System.out.println("Invoking add...");
        com.mobile_live_widgets_prod.services.calculator.Add _add_parameters = null;
        com.mobile_live_widgets_prod.services.calculator.AddResponse _add__return = port.add(_add_parameters);
        System.out.println("add.result=" + _add__return);


        }
        {
        System.out.println("Invoking divide...");
        com.mobile_live_widgets_prod.services.calculator.Divide _divide_parameters = null;
        com.mobile_live_widgets_prod.services.calculator.DivideResponse _divide__return = port.divide(_divide_parameters);
        System.out.println("divide.result=" + _divide__return);


        }
        {
        System.out.println("Invoking multiply...");
        com.mobile_live_widgets_prod.services.calculator.Multiply _multiply_parameters = null;
        com.mobile_live_widgets_prod.services.calculator.MultiplyResponse _multiply__return = port.multiply(_multiply_parameters);
        System.out.println("multiply.result=" + _multiply__return);


        }
        {
        System.out.println("Invoking subtract...");
        com.mobile_live_widgets_prod.services.calculator.Subtract _subtract_parameters = null;
        com.mobile_live_widgets_prod.services.calculator.SubtractResponse _subtract__return = port.subtract(_subtract_parameters);
        System.out.println("subtract.result=" + _subtract__return);


        }

        System.exit(0);
    }

}
